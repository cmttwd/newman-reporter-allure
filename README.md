This is a fork of https://github.com/cmttwd/newman-reporter-allure

## Additions on top of cmttwd's version

Added handling for case where sending request fails and no response is generated.
Previously reporter would silently exit 'on request' handler and then crash to stack trace in 'on item' attempting to access undefined response_data. Now the report will handle such faults and mark them as broken.

Added support for optional parameters to skip each label to fine-tune needed options:
--reporter-allure-no-test-class
--reporter-allure-no-test-method
--reporter-allure-no-features
--reporter-allure-no-stories
--reporter-allure-no-sub-suites
--reporter-allure-no-test-suite
This is for if you want all improvements of cmttwd's fork but use more custom suite behaviour.


## Installation

```bash
$ npm install -g https://github.com/akorov/newman-reporter-allure.git
```

## Run

```bash
$ newman run <Collection> -e <Environment> -r allure
$ newman run <Collection> -e <Environment> -r allure --reporter-allure-export <allure-results-out-dir>
$ newman run <Collection> -e <Environment> -r allure --reporter-allure-export <allure-results-out-dir> --reporter-allure-epic <Epic name> --reporter-allure-owner <Owner name> --reporter-allure-layer <Layer>
```

```bash
--reporter-allure-export <allure-results-out-dir> - results
--reporter-allure-epic <Epic name> - set Epic for all tests in the run
--reporter-allure-owner <Owner name> - set Owner for all tests
--reporter-allure-layer <Layer> - доп параметр
```

## Generating report

```bash
$ allure generate --clean
$ allure generate --clean <allure-results-out-dir>
```

## Viewing report
```bash
$ allure open
$ allure open <allure-report-dir>
```
