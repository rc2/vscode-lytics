## [0.0.15] - 2018-??-????
- (issue 44) Queries are sorted alphabetically.
- (issue 45) Added support for `urlmain` and `hash` functions.
- (issue 46) Added support for spaces in the name of a field from the target system. For example, a column in a CSV may be _member id_.

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