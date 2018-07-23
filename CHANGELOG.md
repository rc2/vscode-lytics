## [0.0.8] - 2018-07-22
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