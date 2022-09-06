const AllureRuntime = require("allure-js-commons").AllureRuntime;
const isPromise = require("allure-js-commons").isPromise;
const Status = require("allure-js-commons").Status;
const LabelName = require("allure-js-commons").LabelName;
const Stage = require("allure-js-commons").Allure;
const createHash = require("crypto").createHash;
const _ = require('lodash');

class AllureReporter {
    constructor(emitter, reporterOptions, options) {
        this.suites = [];
        this.runningItems = [];
        this.currentNMGroup = options.collection;
        var config = {
            resultsDir: reporterOptions.export || "allure-results"
        }
        this.allure_runtime = new AllureRuntime(config);
        this.reporterOptions = reporterOptions;
        this.options = options;
        const events = 'start beforeIteration iteration beforeItem item beforePrerequest prerequest beforeScript script beforeRequest request beforeTest test beforeAssertion assertion console exception beforeDone done'.split(' ');
        events.forEach((e) => {
            if (typeof this[e] == 'function') emitter.on(e, (err, args) => this[e](err, args))
        });
    }

    get currentSuite() {
        if (this.suites.length === 0) {
            return null;
        }
        return this.suites[this.suites.length - 1];
    }

    get currentStep() {
        if (this.runningItems.length === 0)
            return null;
        if (!Array.isArray(this.runningItems[this.runningItems.length - 1].steps))
            return null;
        if (this.runningItems[this.runningItems.length - 1].steps.length === 0)
            return null;
        const steps = this.runningItems[this.runningItems.length - 1].steps;
        return steps[steps.length - 1];
    }

    get currentTest() {
        if (this.runningItems.length === 0)
            throw new Error("No active test");
        const tests_size = this.runningItems.length;
        return this.runningItems[tests_size - 1].allure_test;
    }

    set currentTest(allure_test) {
        this.runningItems[this.runningItems.length - 1].allure_test = allure_test;
    }

    writeAttachment(content, type) {
        return this.allure_runtime.writeAttachment(content, type);
    }

    pushSuite(suite) {
        this.suites.push(suite);
    }

    popSuite() {
        this.suites.pop();
    }

    start(err, args) {
        const suiteName = this.options.collection.name;
        console.log(`### Starting Execution For - ${suiteName} ###`);
        const scope = this.currentSuite || this.allure_runtime;
        const suite = scope.startGroup(suiteName || "Global");
        this.pushSuite(suite);
        this.runningItems = [];
    }

    prerequest(err, args) {
        if (args.executions != undefined && _.isArray(args.executions) && args.executions.length > 0) {
            this.runningItems[this.runningItems.length - 1].pm_item.prerequest = args.executions[0].script.exec.join('\n');
        }
    }

    test(err, args) {
        if (args.executions != undefined && _.isArray(args.executions) && args.executions.length > 0)
            this.runningItems[this.runningItems.length - 1].pm_item.testscript = args.executions[0].script.exec.join('\n');
    }

    console(err, args) {
        if (err) {
            return;
        }
        if (args.level) {
            if (!Array.isArray(this.runningItems[this.runningItems.length - 1].pm_item.console_logs)) {
                this.runningItems[this.runningItems.length - 1].pm_item.console_logs = [];
                this.runningItems[this.runningItems.length - 1].pm_item.console_logs.push(`level: ${args.level}, messages: ${args.messages}`);
            } else {
                this.runningItems[this.runningItems.length - 1].pm_item.console_logs.push(`level: ${args.level}, messages: ${args.messages}`);
            }
        }
    }

    request(err, args) {
        const req = args.request;
        let url = req.url.protocol + "://" + req.url.host.join('.');
        if (req.url.path !== undefined) {
            if (req.url.path.length > 0) {
                url = url + "/" + req.url.path.join('/');
            }
        }
        this.runningItems[this.runningItems.length - 1].pm_item.request_data = {
            url: url,
            method: req.method,
            body: req.body,
            headers: req.headers
        };

        if(err){
            this.runningItems[this.runningItems.length - 1].pm_item.response_data = {
                status: err,
                code: err,
                body: '',
                headers: '',
                cookies: '',
                responseTime: '',
                responseSize: ''
            };
            this.runningItems[this.runningItems.length - 1].pm_item.passed = false;
            this.runningItems[this.runningItems.length - 1].pm_item.errors.push(err);
            
        } else {
            const res = args.response;
            const resp_stream = res.stream;
            const resp_body = Buffer.from(resp_stream).toString();

            this.runningItems[this.runningItems.length - 1].pm_item.response_data = {
                status: res.status,
                code: res.code,
                body: resp_body,
                headers: res.headers,
                cookies: res.cookies,
                responseTime: res.responseTime,
                responseSize: res.responseSize
            };
        }
        //console.log("REQUEST_PM_ITEM=" + JSON.stringify(this.runningItems[this.runningItems.length - 1].pm_item,null, 4));

    }

    startStep(name) {
        const allureStep = this.currentExecutable.startStep(name);
        this.pushStep(allureStep);
        return this;
    }

    endStep(status) {
        let step = this.popStep();
        step.status = status;
        step.endStep();
    }

    assertion(err, args) {
        const stepName = args.assertion;
        const curStep = this.startStep(stepName);

        if (args.skipped){
            this.runningItems[this.runningItems.length - 1].pm_item.skipped = true;
            this.runningItems[this.runningItems.length - 1].pm_item.failedAssertions.push(args.assertion);
            this.runningItems[this.runningItems.length - 1].pm_item.errors.push(err);
            curStep.endStep(Status.FAILED);
        } else if (err) {
            this.runningItems[this.runningItems.length - 1].pm_item.passed = false;
            this.runningItems[this.runningItems.length - 1].pm_item.failedAssertions.push(args.assertion);
            this.runningItems[this.runningItems.length - 1].pm_item.errors.push(err);
            curStep.endStep(Status.FAILED);
        } else {
            curStep.endStep(Status.PASSED);
        }
    }

    script(err, arg){
        if (err) {
            const curStep = this.startStep("ScriptError");
            this.runningItems[this.runningItems.length - 1].pm_item.passed = false;
            this.runningItems[this.runningItems.length - 1].pm_item.failedAssertions.push(err.name);
            this.runningItems[this.runningItems.length - 1].pm_item.errors.push(err);
            curStep.endStep(Status.FAILED);
        }
    }

    done(err, args) {
        if (this.currentSuite !== null) {
            this.currentSuite.endGroup();
            this.popSuite();
        }
        console.log(`#### Finished Execution ####`);
    }

    beforeItem(err, args) {
        let pm_item = {
            name: this.itemName(args.item, args.cursor),
            passed: true,
            failedAssertions: [],
            console_logs: [],
            errors: []
        };

        if (this.currentSuite === null) {
            throw new Error("No active suite");
        }

        var testName = pm_item.name;

        if (testName.indexOf("/") > 0) {
            const len = testName.split("/").length;
            testName = testName.split("/")[len - 1];
        }

        let testFullName = ''

        let allure_test = this.currentSuite.startTest(testName);

        testFullName = pm_item.name;

        const rndStr = Math.random().toString(36).substr(2, 5);

        testFullName = testFullName + '_' + rndStr;

        allure_test.historyId = createHash("md5")
            .update(testFullName)
            .digest("hex");

        allure_test.stage = Stage.RUNNING;

        var itemGroup = args.item.parent();

        var root = !itemGroup || (itemGroup === this.options.collection);

        var fullName = '';
        if (itemGroup && (this.currentNMGroup !== itemGroup)) {
            !root && (fullName = this.getFullName(itemGroup));
            this.currentNMGroup = itemGroup;
        }

        fullName = this.getFullName(this.currentNMGroup);

        
        // Labels: testClass
        var testClass = fullName;
        if (testClass !== undefined 
            && !(this.reporterOptions.noTestClass === true)
            ) {
            allure_test.addLabel(LabelName.TEST_CLASS, testClass);
        }

        // Labels: testMethod
        var testMethod = args.item.name;
        if (testMethod !== undefined
            && !(this.reporterOptions.noTestMethod === true)
            ) {
            allure_test.addLabel(LabelName.TEST_METHOD, testMethod);
        }

        var parentSuite, suite;
        var subSuites = [];

        if (fullName !== '') {
            if (fullName.indexOf('/') > 0) {
                const numFolders = fullName.split("/").length;
                if (numFolders > 0) {
                    parentSuite = fullName.split("/")[0];
                    if (numFolders > 1)
                        suite = fullName.split("/")[1];
                    if (numFolders > 2)
                        subSuites = fullName.split("/").slice(2);
                }
            } else {
                parentSuite = fullName;
            }
        }
        
        // Labels: parentSuite
        // Labels: feature
        if (parentSuite !== undefined
            && !(this.reporterOptions.noFeatures === true)
            ) {
            parentSuite = parentSuite.charAt(0).toUpperCase() + parentSuite.slice(1);
            allure_test.addLabel(LabelName.PARENT_SUITE, parentSuite);
            allure_test.addLabel(LabelName.FEATURE, parentSuite);
        }
        
        // Labels: story
        if (suite !== undefined
            && !(this.reporterOptions.noStories === true)
            ) {
            suite = suite.charAt(0).toUpperCase() + suite.slice(1);
            allure_test.addLabel(LabelName.STORY, suite);
        }
        
        // Labels: subSuite
        if (subSuites !== undefined
            && !(this.reporterOptions.noSubSuites === true)
            ) {
            if (subSuites.length > 0) {
                let captalizedSubSuites = [];

                for (var i = 0; i < subSuites.length; i++) {
                    captalizedSubSuites.push(subSuites[i].charAt(0).toUpperCase() + subSuites[i].slice(1))
                }
                allure_test.addLabel(LabelName.SUB_SUITE, captalizedSubSuites.join(" > "));
            }
        }
        
        // Labels: suite
        let path;
        if (args.item.request.url.path !== undefined) {
            if (args.item.request.url.path.length > 0) {
                path = args.item.request.url.path.join('/');
            }
        }
        if (path !== undefined
            && !(this.reporterOptions.noTestSuite === true)
            )
            allure_test.addLabel(LabelName.SUITE, path);


        var c_args = new Map (Object.entries(this.reporterOptions));

        // Labels: epic
        var epic = c_args.get('epic');
        if (epic !== undefined) {
            allure_test.addLabel(LabelName.EPIC, epic);
        }

        // Labels: owner
        var owner = c_args.get('owner');
        if (owner !== undefined) {
            allure_test.addLabel(LabelName.OWNER, owner);
        }

        // Labels: layer
        var layer = c_args.get('layer');
        if (layer !== undefined) {
            allure_test.addLabel('layer', layer);
        }

        this.runningItems.push({
            name: fullName,
            allure_test: allure_test,
            pm_item: pm_item
        })
    }

    getFullName(item, separator) {
        if (_.isEmpty(item) || !_.isFunction(item.parent) || !_.isFunction(item.forEachParent)) {
            return;
        }
        var chain = [];
        item.forEachParent(function (parent) {
            chain.unshift(parent.name || parent.id);
        });
        item.parent() && chain.push(item.name || item.id); // Add the current item only if it is not the collection
        return chain.join(_.isString(separator) ? separator : '/');
    }

    attachConsoleLogs(logsArr) {
        if (logsArr.length > 0) {
            const buf = Buffer.from(logsArr.join('\n'), "utf8");
            const file = this.allure_runtime.writeAttachment(buf, "text/plain");
            this.currentTest.addAttachment("console_logs", "text/plain", file);
        }
    }

    attachPrerequest(pre_req) {
        if (pre_req !== undefined) {
            const buf = Buffer.from(pre_req, "utf8");
            const file = this.allure_runtime.writeAttachment(buf, "text/plain");
            this.currentTest.addAttachment("pre_request", "text/plain", file);
        }
    }

    attachTestScript(test_scrpt) {
        if (test_scrpt !== undefined) {
            const buf = Buffer.from(test_scrpt, "utf8");
            const file = this.allure_runtime.writeAttachment(buf, "text/plain");
            this.currentTest.addAttachment("test_scrpt", "text/plain", file);
        }
    }

    get currentExecutable() {
        const executable = this.currentStep || this.currentTest;
        if (executable === null) {
            throw new Error("No executable!");
        }
        return executable;
    }

    setDescription(description) {
        if (description !== undefined) {
            this.currentExecutable.description = description;
        }
    }

    setDescriptionHtml(html) {
        if (html !== undefined) {
            this.currentExecutable.descriptionHtml = html;
        }
    }

    passTestCase(allure_test) {
        this.endTest(allure_test, Status.PASSED);
    }

    failTestCase(allure_test, error) {
        const latestStatus = allure_test.status;
        // if test already has a failed state, we should not overwrite it
        if (latestStatus === Status.FAILED || latestStatus === Status.BROKEN || latestStatus === Status.SKIPPED) {
            return;
        }

        var status;
        var message = error.message;
        var stack = error.stack;

        if (error.skipped){
            status = Status.SKIPPED;
            message = "SKIPPED";
            stack = "";
        } else {
            status = error.name === "AssertionError" ? Status.FAILED : Status.BROKEN;
        }

        this.endTest(allure_test, status, {message: message, trace: stack});
    }

    item(err, args) {

        // FullName
        var path = this.getFullName(this.currentNMGroup);
        var testName = args.item.name;
        if (path !== undefined && testName !== undefined) {
            this.currentExecutable.fullName = (path + '/' + testName);
        }

        const rItem = this.runningItems[this.runningItems.length - 1];

        if (rItem.pm_item.prerequest !== '') {
            this.attachPrerequest(rItem.pm_item.prerequest);
        }

        if (rItem.pm_item.testscript !== '') {
            this.attachTestScript(rItem.pm_item.testscript);
        }

        if (rItem.pm_item.console_logs.length > 0) {
            this.attachConsoleLogs(rItem.pm_item.console_logs);
        }

        const requestDataURL = rItem.pm_item.request_data.method + " - " + rItem.pm_item.request_data.url;
        let bodyModeProp = '';
        let bodyModePropObj;

        if (rItem.pm_item.request_data.body !== undefined) {
            bodyModeProp = rItem.pm_item.request_data.body.mode;
        }
        if (bodyModeProp === "raw") {
            bodyModePropObj = rItem.pm_item.request_data.body[bodyModeProp];
//            console.log(bodyModePropObj); // Вывод в консоль тела запроса
        } else {
            bodyModePropObj = ""
        }

        const responseCodeStatus = rItem.pm_item.response_data.code + " - " + rItem.pm_item.response_data.status;

        var testDescription;
        if (args.item.request.description !== undefined) {
            testDescription = args.item.request.description.content;
            testDescription = testDescription.replace(/[*]/g, "");
            testDescription = testDescription.replace(/\n/g, "<br>")
        } else {
            testDescription = '';
        }

        const reqBodyTable = createDataTableHTML(`BODY - ${bodyModeProp}`, bodyModePropObj);
        const reqHeaderTable = createDataTableHTML('HEADERS', rItem.pm_item.request_data.headers);

        let responseBodyFormatted;
        try {
            responseBodyFormatted = JSON.stringify(JSON.parse(rItem.pm_item.response_data.body), null, 4);
        } catch (err) {
            responseBodyFormatted = rItem.pm_item.response_data.body;
        }

        // Ограничение в прикреплении большого тела ответа
        let responseBodySize = responseBodyFormatted.length;

        if (responseBodySize > 100000){
            responseBodyFormatted = responseBodyFormatted.substring(0, 50000) + "\n\n< Body size: " + responseBodySize + " >";
        }

        const resBodyTable = createDataTableHTML('BODY', responseBodyFormatted);
        const resHeaderTable = createDataTableHTML('HEADERS', rItem.pm_item.response_data.headers);
        const resCookieTable = createDataTableHTML('COOKIES', rItem.pm_item.response_data.cookies);

        this.setDescriptionHtml(`
            <p>${testDescription}</p>

            <p><h3 style="color: #DC143C">  Request  </h3></p>
            <p style="color: #888888">${requestDataURL}</p>
            <p>${reqHeaderTable}</p>
            <p>${reqBodyTable}</p>

            <h3 style="color: #DC143C">  Response  </h3>
            <p style="color: #888888">Status: ${responseCodeStatus}</p>
            <p style="color: #888888">Timing: ${rItem.pm_item.response_data.responseTime} ms</p>
            <p style="color: #888888">Size: ${rItem.pm_item.response_data.responseSize} B</p>
            <p>${resHeaderTable}</p>
            <p>${resBodyTable}</p>
            <p>${resCookieTable}</p>`
        );

        if (rItem.pm_item.failedAssertions.length > 0) {

            // Сообщение об ошибке (перечисление всех ассертов)
            const msg = this.escape(rItem.pm_item.failedAssertions.join(", "));

            // StackTrace всех ассертов
            const details = rItem.pm_item.errors
                    .filter(e => e != null)
                    .map(e => e.test + "\n" + e.message + "\n")
                    .join("\n");

            this.failTestCase(rItem.allure_test, {
                name: "AssertionError",
                message: msg,
                stack: details,
                skipped: rItem.pm_item.skipped
            });

        } else {
            // if we have pm_item.errors but not pm_item.failedAssertions, fail test case
            if (rItem.pm_item.errors.length > 0){
                const err = rItem.pm_item.errors
                            .filter(e => e != null)
                            .map(e => e)
                            .join("\n");

                this.failTestCase(rItem.allure_test, {
                    name: "Pre-assertions error",
                    message: err,
                    skipped: rItem.pm_item.skipped
                });
            } else {
                this.passTestCase(rItem.allure_test);
            }
        }

        this.runningItems.pop();
    }

    pushStep(step) {
        if (!Array.isArray(this.runningItems[this.runningItems.length - 1].steps)) this.runningItems[this.runningItems.length - 1].steps = [];
        this.runningItems[this.runningItems.length - 1].steps.push(step);
    }

    popStep() {
        return this.runningItems[this.runningItems.length - 1].steps.pop();
    }

    endTest(allure_test, status, details) {
        if (details) {
            allure_test.statusDetails = details;
        }
        allure_test.status = status;
        allure_test.stage = Stage.FINISHED;
        allure_test.endTest();
    }

    itemName(item, cursor) {
        const parentName = item.parent && item.parent() && item.parent().name ? item.parent().name : "";
        const folderOrEmpty = (!parentName || parentName === this.options.collection.name) ? "" : parentName + "/";
        const iteration = cursor && cursor.cycles > 1 ? "/" + cursor.iteration : "";
        return this.escape(folderOrEmpty + item.name + iteration);
    }

    escape(string) {
        return string
            .replace('\n', '')
            .replace('\r', '')
            .replace('\"', '"');
        //.replace(/[\u0100-\uffff]/g, (c) => `|0x${c.charCodeAt(0).toString(16).padStart(4, "0")}`);
    }
}

function createDataTableHTML(header, data) {
    return `<div>
                <table style="border: 1px solid #dddddd; text-align: left; padding: 2px; border-collapse: unset;">
                    <tr>
                        <th>${header}</th>
                    </tr>
                    <tr>
                        <td><pre>${data}</pre></td>
                    </tr>
                </table>
            </div>`;
}

module.exports = AllureReporter;
