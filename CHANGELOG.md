## [0.0.??] - 2018-??-??
- (issue 91) Added explorer for Lytics account settings and the ability to edit boolean settings.
- (issue 94) Fixed problem with downloading multiple queries.
- (issue 96) Improved account selection interface.

## [0.0.25] - 2018-09-21
- (issue 86) Support for latest subscription API, and the ability to specify which user fields to include in a webhook configuration.
- (issue 88) Added support for `map[string]bool` in LQL syntax highlighting.
- (issue 89) Added support for CSV column names with special characters.

## [0.0.24] - 2018-09-18
- (issue 82) Added ability to select a file when content classification is run from command palette.
- (issue 84) Added an error message when a user tries to edit an unsupported subscription type.

## [0.0.23] - 2018-09-17
- (issue 79) Added ability to change the access token (API key) for an account.

## [0.0.22] - 2018-09-17
- (issue 75) Explorers in the Lytics view are now sorted in alphabetical order.
- (issue 77) Subscription explorer and CRUD support for webhook subscriptions.

## [0.0.21] - 2018-09-05
- (issue 73) Fixed bug with selecting data stream fields using the command.

## [0.0.20] - 2018-09-05
- (issue 72) Fixed bug with table sort.

## [0.0.19] - 2018-09-05
- (issue 65) Added ability to open a terminal with LIOKEY environment variable pre-configured.
- (issue 66) Better support for showing appropriate commands.
- (issue 67) Improved support for command palette.
- (issue 68) Added segment explorer.
- (issue 69) Added topic explorer.
- (issue 71) Added sorting due to change in lytics-js v0.24.

## [0.0.18] - 2018-08-27
- (issue 63) Fixed commands so LQL upload and content classification features work.

## [0.0.17] - 2018-08-26
- (issue 56) Added dash as a valid character for data stream field name in LQL.
- (issue 58) Added ability to whitelist table fields from table explorer.
- (issue 59) Removed _refresh campaign list_ command from command palette.

## [0.0.16] - 2018-08-25
- (issue 53) Added support for campaign overrides.
- (issue 54) Lytics content provider read directly from Lytics every time (instead of using the content provider cache).
- Refactored content explorers to use inheritance to reduce code duplication.

## [0.0.15] - 2018-08-20
- (issue 43) Fixed error that was displayed when loading a Lytics account with no campaigns.
- (issue 44) Queries are sorted alphabetically.
- (issue 45) Added support for `urlmain` and `hash` functions.
- (issue 46) Added support for spaces in the name of a field from the target system. For example, a column in a CSV may be _member id_.
- (issue 47) Added the ability to select the folder to watch when running the watch command from the Visual Studio Code command palette.

## [0.0.14] - 2018-08-09
- (issue 38) Added explorer for campaign details. It lists available campaigns and variations, and allows you to display details for each.
- (issue 39) Added ability to run content classification on files and the active editor window.

## [0.0.13] - 2018-08-04
- (issue 33) Changed _lytics watch_ menu option text to be more descriptive.
- (issue 35) Added support for new _tolql_ API. You can select a _csv_ file and generate LQL from it.
- (issue 37) Added syntax highlighting support for _cap()_ function.

## [0.0.12] - 2018-08-03
- (issue 24) Added ability to export accounts to FileZilla. This creates a file that can be imported into FileZilla. For each account, an sFTP site is created.
- (issue 26) Added ability to upload LQL file from file explorer.
- (issue 28) Added ability to start Lytics watch from file explorer.
- (issue 30) Refactored to use [lytics-js](https://www.npmjs.com/package/lytics-js) module.

## [0.0.11] - 2018-07-26
- (issue 22) Fixed bug where download/open query was showing JSON instead of the query text.

## [0.0.10] - 2018-07-25
- (issue 20) Added command on table explorer for identifier fields to allow you to search on that field.

## [0.0.9] - 2018-07-22
- Added more descriptive error message when an invalid API key is provided.
- (issue 1) Added support for the function `valuect` in LQL files.
- (issue 9) Added support for API keys that have multiple accounts associated with them.
- (issue 10) Do not display error message if the account does not have any data streams available. This situation occurs when a new account is created and no data has been ingested yet.
- (issue 11) Fixed problem with downloading and uploading queries when running Visual Studio Code on Windows.
- (issue 18) Added ability to list the queries that use a specific data stream.

## [0.0.7] - 2018-07-11
- **Download queries** - Queries can be downloaded as lql files. This can be done on an individual query, or at the table level (i.e. download all user queries).
- Updated icons. 
- Added support for multi-line comments.
- Added support for field names that start with _ character.

## [0.0.6] - 2018-07-09
### Added
- Added back explorer view commands accidentally removed.

## [0.0.5] - 2018-07-08
### Added
- **Upload LQL to Lytics** - Add editor context command for uploading LQL to Lytics. After an LQL file is saved locally, the user can right-click in the editor and select an option to upload the file to Lytics.

### Changed
None. 

### Removed
- Reduce the number of commands available in the command palette.

## [0.0.4] - 2015-07-07
Initial release.