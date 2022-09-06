This is a fork of https://github.com/dvargas46/newman-reporter-allure

## Additions on top of dvargas46 version

- Implemented support Allure TestOps:
  - Added Labels: testClass, testMethod, epic, owner, layer.
  - Changed the logic of the formation of story and suite parameters.


- There are no problems with the formation of Russian-language test names.


- Added handling of test-scripts errors.


- Added ability to set "SKIPPED" status via 'pm.test.skip("Skip message")'.


- Added handling for case where sending request fails and no response is generated.
Previously reporter would silently exit 'on request' handler and then crash to stack trace in 'on item' attempting to access undefined response_data. Now the report will handle such faults and mark them as broken.

  (thanks @akorov)


- Added support for optional parameters to skip each label to fine-tune needed options:
    ```
    --reporter-allure-no-test-class
    --reporter-allure-no-test-method
    --reporter-allure-no-features
    --reporter-allure-no-stories
    --reporter-allure-no-sub-suites
    --reporter-allure-no-test-suite
    ```
    (thanks @akorov)

## Installation

```bash
$ npm install -g https://github.com/cmttwd/newman-reporter-allure.git
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
--reporter-allure-layer <Layer> - set 'Layer' parameter for all tests
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
