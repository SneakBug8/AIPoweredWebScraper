# Architecture

CarPricesAnalysis is a Telegram-controlled car price scraper. A Node.js/TypeScript application that crawls car sale websites with Selenium, saves page HTML, converts it to Markdown, uses an LLM (Groq) to extract structured car posting fields, and stores everything in a local SQLite database. State is kept in the DB, so scraping is resumable across restarts.

---

## Modules and Services

### Application entry point (`src/index.ts`)

The `App` class, exported as the `Server` singleton. Wires the Telegram bot, authorization and command routing.

- `setWaitingForValue(message, callback)` - asks the user for input via bot message and registers a one-shot callback to handle the next user message (`/exit` cancels).
- `setWaitingForValuePure(callback)` - same without prompting.
- `defaultKeyboard()` - default reply keyboard (`/scrape_kentavar`, `/scrape_autobg`, `/convert_to_md`, `/extract_fields`).
- `App.messageHandler(msg)` - serializes incoming messages, performs auth checks (`AuthService`), dispatches to registered command processors (`ProcessScraper`, `ProcessBackup`) and to `MessageEvent` subscribers.
- `App.Intervals()` - runs every 15 minutes; executes `Scheduler.Interval()` and `BackupCycle()`, emits `IntervalEvent`.
- `App.SendMessage(text, keyboard?, parse_mode?)` - sends a message to the configured default chat.
- `App.WaitForLoad()` - resolves once startup finished.

### Configuration service (`src/config.ts`)

`ConfigClass`, exported as the `Config` singleton. Reads settings from environment variables.

- `AllowedChats: number[]` / `DefaultChat: number` / `Password: string`
- Key getters: `ilovepdfpublickey()`, `converterkey()`, `ilovepdfprivatekey()`, `ftphost()`, `ftpuser()`, `ftppassword()`, `ftpbasepath()`, `CockpitURL()`, `CockpitToken()`, `KanbanURL()`, `KanbanToken()`, `mtprotoApiID()`, `mtprotoApiHash()`, `mtprotoPhoneNumber()`.
- `get(key)` - generic env lookup.
- Path helpers: `basePath()`, `projectPath()`, `dataPath()`, `port()`.
- Environment helpers: `isProduction()`, `isDev()`, `setTest()`, `isTest()`.

### Authentication service (`src/AuthService.ts`)

`AuthServiceClass`, exported as the `AuthService` singleton.

- `TryAuth(pswd, chatId): boolean` - authorizes a chat by master password or allowed-chat whitelist.
- `CheckAuth(chatId): boolean` - returns whether the chat is authorized.
- `ResetAuth()` - drops current authorization.

### Message wrapper (`src/MessageWrapper.ts`)

Convenience wrapper over a Telegram message.

- `deleteAfterTime(minutes)` - schedules deletion of the message.
- `reply(text, keyboard?, parse_mode?)` / `replyMany(texts[])` - send replies.
- `checkRegex(regexp)` / `captureRegex(regexp)` - test/capture against message text.
- `getPrintableTime()` - formatted time of the original message.

### Database layer (`src/Database.ts`)

Knex-based SQLite access.

- `Connection<T>(table)` - query builder bound to `data/db.db`.
- `ConstructNamedConnection(filename)` - separate `.db` file per name.
- Tables are created implicitly by knex on first use.

### Entity framework (`src/entity/Entity.ts`, `src/entity/EntityFactory.ts`)

Base class and generic repository shared by all persistent entities.

- `Entity` base fields: `Id`, `MIS_DT` (creation timestamp), `UPDATED_DT`, `DELETED_DT` (soft delete marker).
- `EntityFactory<T>` methods: `GetById(id)`, `GetByName(name)`, `GetAll()`, `Count()`, `Insert(entity)`, `Update(entity)`, `Delete(entity)` (soft delete - sets `DELETED_DT`; all queries filter deleted rows), `HardDelete(id)`, overridable `Parse(t)`/`Cleanup(t)` hooks.

### Scraper module (`src/scraper/`)

Core business logic of the application.

#### `ScraperService.ts`

- `ScrapePage(driver, url, source)` - opens a single URL with Selenium (retries until success, 10 s timeout per attempt), skips pages returning HTTP 404 (deletes their `ScrapedPageRecord`), collects matching `a[href]` links into the queue, upserts the `ScrapedPageRecord` for the URL, removes unwanted DOM elements and saves the root element HTML into `data/<source.folderName>/`.
- `RunFullScraping(message, source)` - main crawl loop: pops shuffled URLs from the DB queue, calls `ScrapePage` with random delays, refreshes the queue until empty, then quits the driver and reports scraped-page count.
- `ExtractMarkdown(pagehtmlpath, markdownpath)` - converts one HTML file to Markdown using Turndown.
- `ConvertAllToMd(message)` - processes the MD extraction queue, writes files under `data/md/`, sets `mdfilepath`.
- `ExtractFields(record, content, model)` - filters non-car pages by content heuristics, asks Groq (JSON-schema constrained) to extract car fields, upserts a `CarPostingRecord` keyed by source URL.
- `ExtractAllFields(message)` - processes the field extraction queue with model fallback (`openai/gpt-oss-20b` -> `openai/gpt-oss-120b`), clears `mdfilepath` on success.
- `ProcessScraper(message)` - command router for `/status`, `/scrape_kentavar`, `/scrape_autobg`, `/convert_to_md`, `/extract_fields`.
- Helpers: `shuffle(array)`, `getRandomInt(max)`; a module-level Firefox `WebDriver` is created at startup.

#### `ScrapeSource.ts`

Site-specific configuration interface plus two presets:

| Field | Type | Meaning |
|---|---|---|
| `folderName` | `string` | subfolder of `data/` for HTML output |
| `initialUrl` | `string` | crawl entry point |
| `categoryUrl` | `string` | only links containing this URL are followed/saved |
| `rootElementSelectors[]` | `string[]` | CSS selectors tried in order for the meaningful page root |
| `unwantedElementsSelectors[]` | `string[]` | selectors removed from the page before saving |

Presets: `KentavarSource` (kentavar.bg), `AutoBgSource` (auto.bg).

#### Entities/repositories

- `ScrapedPage.ts` - `ScrapedPageRecord` + repository with `GetWithURL(url)`, `GetLatest(count)`, `GetScrapingQueueURLs()`, `GetRecentlyScrapedURLs()`, `GetMDExtractionQueue()`, `GetFieldExtractionQueue()`. Table `ScrapedPageRecords`.
- `CarPostingRecord.ts` - `CarPostingRecord` + repository with `GetWithSource(source)`, `GetLatest(count)`. Table `CarPostings`.

### Backup service (`src/backup/BackupService.ts`)

Zips the data directory and uploads it to remote FTP storage.

- `InitBackup()` - loads persisted state (`data/backup.json`), schedules `CreateBackup` at hour 20.
- `CreateBackup(force?)` - runs at most every 2 days unless forced: creates archive, uploads via FTP, notifies the chat.
- `MakeBackupArchive()` - builds `backup.zip` (archiver).
- `PublishBackupArchive(verbose?)` - FTP upload (basic-ftp).
- `BackupSave()` - persists `BackupData` state.
- `BackupCycle()` - periodic hook (currently disabled logic).
- `ProcessBackup(message)` - command router for `/backup force`.
- `BackupData` (`src/backup/BackupData.ts`) - persisted state `{ lastSend: number }`.

### API integrations (`src/api/`)

- `bot.ts` - `BotAPI`: `node-telegram-bot-api` client with polling enabled.
- `groq.ts` - `GroqAPI`: Groq SDK client used for LLM field extraction.
- `web.ts` - `WebApi`: Express application (EJS views, static assets, password-cookie gate, index route). Currently not started from `index.ts` (kept for future use).
- `RequestRepeater.ts` - `RequestRepeater<T>(fun, backup?, tries=5)`: retries an async call up to N times, returns fallback value on failure; serializes concurrent requests.

### Utility modules (`src/util/`)

- `MIS_DT` - millisecond-timestamp helpers: `GetDay()`, `GetHour()`, `GetExact()`, `Various(date)`, `RoundToDay(date)`, duration constants `OneSecond()/OneMinute()/OneHour()/OneDay()/OneWeek()`, formatters `FormatDate()`, `FormatTime()`, `FormatMonth()`.
- `Scheduler` - in-memory hourly scheduler: `Schedule(hour, callback, title?)`, `Run(hour)`, `Interval()` (executes due entries once per hour, tracked via `IntervalsExecution`).
- `IntervalsExecution` - idempotency ledger stored in table `IntervalsExecutions`: `Executed(flag)`, `Execute(flag)`; entries older than 30 days are pruned.
- `SyncEvent` - sequential async event emitter: `Subscribe(listener)`, `Emit(...args)` (stops after first non-false result).
- `Sleep(ms)` - promise-based delay.
- `ErrorLogger.Log(e)` - safe error logging.
- `FileStorage` - load/save JSON files under `data/`: `Load()`, `Save()`.
- `MapAsync.Map(arr, callback)` - parallel map helper.
- `MapToObject.Convert(map)` - map to array-of-pairs conversion.
- `HtmlFormat.FromHtml(text)` / `ToHtml(text)` - strip/restore HTML entities and tags.
- `FindMyIp.Ipify()` - external IP lookup via api.ipify.org.
- `Color.GetColor(index)` / `GetAlphaColor(index)` / `GetBackground(index)` - palette helpers for charts.
- `StringIncludes(where, what)`, `shortNum(num)` (`EqualString.ts`) - string/number formatting.
- `Symbols.Russian()` - Cyrillic alphabet array.
- `WebHelper.Error(res, msg)` / `Success(res, msg)` - JSON responses for Express routes.

---

## Data Model

All persistent entities extend `Entity`:

| Field | Type | Description |
|---|---|---|
| `Id` | `number \| undefined` | primary key (auto-increment) |
| `MIS_DT` | `number` | creation timestamp (ms epoch) |
| `UPDATED_DT` | `number` | last update timestamp (ms epoch) |
| `DELETED_DT` | `number \| undefined` | soft-delete marker; `null` = alive |

Database: SQLite at `data/db.db` (knex). Soft-deleted rows are hidden by the repository layer.

### ScrapedPageRecord (table `ScrapedPageRecords`)

One row per discovered URL; drives all scraper queues.

| Field | Type | Description |
|---|---|---|
| `URL` | `string` | full page URL |
| `htmlfilepath` | `string \| null` | path of saved HTML file; `null` = not yet saved |
| `mdfilepath` | `string \| null` | path of converted Markdown file; `null` = not yet converted |
| `LAST_FETCHED` | `number` | ms timestamp of the last fetch attempt |

Derived queues:
- *Scraping queue*: `htmlfilepath IS NULL AND LAST_FETCHED <= now - 30 days`.
- *Recently scraped*: `htmlfilepath IS NOT NULL AND LAST_FETCHED > now - 30 days`.
- *MD extraction queue*: `htmlfilepath NOT NULL AND mdfilepath IS NULL`.
- *Field extraction queue*: `mdfilepath NOT NULL`.

### CarPostingRecord (table `CarPostings`)

Structured car sale posting extracted by the LLM; unique per source URL.

| Field | Type | Description |
|---|---|---|
| `car_brand` | `string` | brand |
| `model` | `string` | model |
| `year_of_production` | `string` | production year (as extracted) |
| `mileage` | `number` | mileage |
| `price` | `number` | price in EUR |
| `is_automatic_transmission_type` | `boolean \| null` | automatic transmission flag |
| `shop` | `string` | shop identifier (default `"default"`) |
| `source` | `string` | URL of the posting page |

### IntervalsExecution (table `IntervalsExecutions`)

Ledger of scheduled-task executions (hourly idempotency).

| Field | Type | Description |
|---|---|---|
| `MIS_DT` | `number` | execution hour rounded to ms epoch |
| `flag` | `string` | task identifier |

### Non-database artifacts

- `data/db.db` - SQLite database.
- `data/kentavar/*.html`, `data/autobg/*.html` - scraped page HTML.
- `data/md/*.md` - converted Markdown files.
- `data/backup.json` - backup service state (`lastSend: number`).
- `backup.zip` - archive uploaded to FTP.

---

## Key Flows

All flows start with a Telegram command sent to an authorized chat. Commands are matched in `ProcessScraper` (`src/scraper/ScraperService.ts`).

### Scrape Kentavar (`/scrape_kentavar`)

1. `RunFullScraping(KentavarSource)` starts asynchronously; the queue initially holds only `initialUrl`.
2. Loop: pop a URL (queue is shuffled each cycle for coverage), skip if recently scraped.
3. `ScrapePage` opens the URL in headless Firefox with retries; pages responding **404** are skipped and their records deleted.
4. Links on the page that match `categoryUrl`/`initialUrl` are inserted as new `ScrapedPageRecord`s (the queue grows as crawling proceeds).
5. The visited record's `LAST_FETCHED` is updated; unwanted elements (images, contacts, headers...) are removed from the DOM and the best-matching root element HTML is written to `data/kentavar/<page>.html`; the record's `htmlfilepath` is set.
6. Random delay between pages (1-16 s). Continues until the queue is empty, then reports the count of newly scraped pages.

### Scrape AutoBG (`/scrape_autobg`)

Identical flow to *Scrape Kentavar* but driven by `AutoBgSource`: different initial/category URLs, root selector `main .container`, different clutter removal rules, output folder `data/autobg/`.

### Convert to Markdown (`/convert_to_md`)

1. `ConvertAllToMd` fetches the MD extraction queue (records with `htmlfilepath` set but no `mdfilepath`).
2. For each record, the HTML file content is converted with Turndown.
3. Result is written to `data/md/<original-name>.html.md` and `mdfilepath` is updated on the record.
4. Replies with the number of converted files.

### Extract Fields (`/extract_fields`)

1. `ExtractAllFields` fetches the field extraction queue (records with `mdfilepath` set), shuffles them.
2. For each record, the Markdown content is checked: pages must contain "цена" (price) and must not contain "page not found".
3. Groq LLM extracts structured fields constrained by a JSON schema (`is_single_car_page`, `car_brand`, `model`, `year_of_production`, `mileage`, `price`, `is_automatic_transmission_type`); single-car pages with price above ~1000 EUR are accepted.
4. A `CarPostingRecord` is created or updated (matched by `source` URL).
5. On API failure the request is retried with the larger `openai/gpt-oss-120b` model.
6. After success `mdfilepath` is cleared (file retention currently commented out); replies with the count of processed files.

### Background flows

- Every 15 minutes: `Scheduler.Interval()` executes tasks scheduled for the current hour (e.g., daily backup at hour 20) exactly once per hour; `BackupCycle()` hook runs.
- Backup (`InitBackup`/`CreateBackup`): at most every 2 days, zips `data/` and uploads `backup.zip` to FTP, notifying the default chat.
