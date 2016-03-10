"use strict";

import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import sinon from "sinon";
import { EventEmitter } from "events";
import { fakeServerResponse } from "./test_utils.js";
import KintoClient, { SUPPORTED_PROTOCOL_VERSION as SPV } from "../src";
import * as requests from "../src/requests";
import Bucket from "../src/bucket";

chai.use(chaiAsPromised);
chai.should();
chai.config.includeStack = true;

const root = typeof window === "object" ? window : global;
const FAKE_SERVER_URL = "http://fake-server/v1";

/** @test {KintoClient} */
describe("KintoClient", () => {
  let sandbox, api, events;

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    events = new EventEmitter();
    api = new KintoClient(FAKE_SERVER_URL, {events});
  });

  afterEach(() => {
    sandbox.restore();
  });

  /** @test {KintoClient#constructor} */
  describe("#constructor", () => {
    const sampleRemote = `http://test/${SPV}`;

    it("should check that `remote` is a string", () => {
      expect(() => new KintoClient(42, {events}))
        .to.Throw(Error, /Invalid remote URL/);
    });

    it("should validate `remote` arg value", () => {
      expect(() => new KintoClient("http://nope"))
        .to.Throw(Error, /The remote URL must contain the version/);
    });

    it("should strip any trailing slash", () => {
      expect(new KintoClient(sampleRemote).remote).eql(sampleRemote);
    });

    it("should expose a passed events instance option", () => {
      expect(new KintoClient(sampleRemote, {events}).events).to.eql(events);
    });

    it("should propagate its events property to child dependencies", () => {
      const api = new KintoClient(sampleRemote, {events});
      expect(api.http.events).eql(api.events);
    });

    it("should assign version value", () => {
      expect(new KintoClient(sampleRemote).version).eql(SPV);
      expect(new KintoClient(sampleRemote).version).eql(SPV);
    });

    it("should accept a headers option", () => {
      expect(new KintoClient(sampleRemote, {headers: {Foo: "Bar"}})
              .defaultReqOptions.headers).eql({Foo: "Bar"});
    });

    it("should validate protocol version", () => {
      expect(() => new KintoClient("http://test/v999"))
        .to.Throw(Error, /^Unsupported protocol version/);
    });

    it("should propagate the requestMode option to the child HTTP instance", () => {
      const requestMode = "no-cors";
      expect(new KintoClient(sampleRemote, {requestMode}).http.requestMode)
        .eql(requestMode);
    });

    it("should create an event emitter if none is provided", () => {
      expect(new KintoClient(sampleRemote).events)
        .to.be.an.instanceOf(EventEmitter);
    });

    it("should expose provided event emitter as a property", () => {
      const events = new EventEmitter();
      expect(new KintoClient(sampleRemote, {events}).events).eql(events);
    });

    it("should accept a bucket option", () => {
      const api = new KintoClient(sampleRemote, {bucket: "custom"});
      expect(api.defaultReqOptions.bucket).eql("custom");
    });

    it("should accept a safe option", () => {
      const api = new KintoClient(sampleRemote, {safe: true});
      expect(api.defaultReqOptions.safe).eql(true);
    });
  });

  /** @test {KintoClient#backoff} */
  describe("get backoff()", () => {
    it("should provide the remaining backoff time in ms if any", () => {
      // Make Date#getTime always returning 1000000, for predictability
      sandbox.stub(Date.prototype, "getTime").returns(1000 * 1000);
      sandbox.stub(root, "fetch").returns(
        fakeServerResponse(200, {}, {Backoff: "1000"}));

      return api.listBuckets()
        .then(_ => expect(api.backoff).eql(1000000));
    });

    it("should provide no remaining backoff time when none is set", () => {
      sandbox.stub(root, "fetch").returns(fakeServerResponse(200, {}, {}));

      return api.listBuckets()
        .then(_ => expect(api.backoff).eql(0));
    });
  });

  /** @test {KintoClient#bucket} */
  describe("#bucket()", () => {
    it("should return a Bucket instance", () => {
      expect(api.bucket("foo"))
        .to.be.an.instanceOf(Bucket);
    });

    it("should propagate default req options to bucket instance", () => {
      const options = {safe: true, headers: {Foo: "Bar"}};

      expect(api.bucket("foo", options))
        .to.have.property("options").eql(options);
    });
  });

  /** @test {KintoClient#fetchServerInfo} */
  describe("#fetchServerInfo", () => {
    const fakeServerInfo = {fake: true};

    it("should retrieve server settings on first request made", () => {
      sandbox.stub(root, "fetch")
        .returns(fakeServerResponse(200, fakeServerInfo));

      return api.fetchServerInfo()
        .should.eventually.become(fakeServerInfo);
    });

    it("should store server settings into the serverSettings property", () => {
      api.serverSettings = {a: 1};
      sandbox.stub(root, "fetch");

      api.fetchServerInfo();
    });

    it("should not fetch server settings if they're cached already", () => {
      api.serverInfo = fakeServerInfo;
      sandbox.stub(root, "fetch");

      api.fetchServerInfo();
      sinon.assert.notCalled(fetch);
    });
  });

  /** @test {KintoClient#fetchServerSettings} */
  describe("#fetchServerSettings()", () => {
    const fakeServerInfo = {settings: {fake: true}};

    it("should retrieve server settings", () => {
      sandbox.stub(root, "fetch")
        .returns(fakeServerResponse(200, fakeServerInfo));

      return api.fetchServerSettings()
        .should.eventually.have.property("fake").eql(true);
    });
  });

  /** @test {KintoClient#fetchServerCapabilities} */
  describe("#fetchServerCapabilities()", () => {
    const fakeServerInfo = {capabilities: {fake: true}};

    it("should retrieve server capabilities", () => {
      sandbox.stub(root, "fetch")
        .returns(fakeServerResponse(200, fakeServerInfo));

      return api.fetchServerCapabilities()
        .should.eventually.have.property("fake").eql(true);
    });
  });

  /** @test {KintoClient#fetchUser} */
  describe("#fetchUser()", () => {
    const fakeServerInfo = {user: {fake: true}};

    it("should retrieve user information", () => {
      sandbox.stub(root, "fetch")
        .returns(fakeServerResponse(200, fakeServerInfo));

      return api.fetchUser()
        .should.eventually.have.property("fake").eql(true);
    });
  });

  /** @test {KintoClient#fetchHTTPApiVersion} */
  describe("#fetchHTTPApiVersion()", () => {
    const fakeServerInfo = {http_api_version: {fake: true}};

    it("should retrieve current API version", () => {
      sandbox.stub(root, "fetch")
        .returns(fakeServerResponse(200, fakeServerInfo));

      return api.fetchHTTPApiVersion()
        .should.eventually.have.property("fake").eql(true);
    });
  });

  /** @test {KintoClient#ensureSupported} */
  describe("#ensureSupported()", () => {
    describe("Supported http_api_version", () => {
      it("should execute a function when http_api_version is supported", () => {
        api.serverInfo = {http_api_version: "1.4"};
        const spy = sandbox.spy();

        return api.ensureSupported("1.0", "2.0", spy)
          .then(_ => {
            sinon.assert.called(spy);
          });
      });
    });

    describe("Unsupported http_api_version version", () => {
      beforeEach(() => {
        api.serverInfo = {http_api_version: "1.3"};
      });

      it("should reject when http_api_version is not supported", () => {
        return api.ensureSupported("1.4", "2.0", () => {})
          .should.be.rejectedWith(Error,
            "Version 1.3 doesn't match 1.4 <= x < 2.0");
      });

      it("should not execute a function when http_api_version is not supported", () => {
        const spy = sandbox.spy();

        return api.ensureSupported("1.4", "2.0", spy)
          .catch(_ => {
            sinon.assert.notCalled(spy);
          });
      });
    });
  });

  /** @test {KintoClient#batch} */
  describe("#batch", () => {
    beforeEach(() => {
      sandbox.stub(api, "fetchServerSettings").returns(Promise.resolve({
        "batch_max_requests": 3
      }));
    });

    function executeBatch(fixtures, options) {
      return api.batch(batch => {
        for (const article of fixtures) {
          batch.createRecord("blog", article);
        }
      }, options);
    }

    describe("server request", () => {
      let requestBody, requestHeaders;

      beforeEach(() => {
        sandbox.stub(root, "fetch").returns(fakeServerResponse(200, {
          responses: []
        }));
      });

      it("should ensure server settings are fetched", () => {
        return api.batch(batch => batch.createCollection())
          .then(_ => sinon.assert.called(api.fetchServerSettings));
      });

      describe("empty request list", () => {
        it("should not perform request on empty operation list", () => {
          api.batch(batch => {});

          sinon.assert.notCalled(fetch);
        });
      });

      describe("non-empty request list", () => {
        const fixtures = [
          {title: "art1"},
          {title: "art2"},
          {title: "art3"},
        ];

        beforeEach(() => {
          api.defaultReqOptions.headers = {Authorization: "Basic plop"};
          return api.batch(batch => {
            for (const article of fixtures) {
              batch.createRecord("blog", article);
            }
          }, {headers: {Foo: "Bar"}})
            .then(_ => {
              const request = fetch.firstCall.args[1];
              requestHeaders = request.headers;
              requestBody = JSON.parse(request.body);
            });
        });

        it("should call the batch endpoint", () => {
          sinon.assert.calledWithMatch(fetch, `/${SPV}/batch`);
        });

        it("should define main batch request default headers", () => {
          expect(requestBody.defaults.headers).eql({
            "Authorization": "Basic plop",
            "Foo": "Bar",
          });
        });

        it("should attach all batch request headers", () => {
          expect(requestHeaders.Authorization).eql("Basic plop");
        });

        it("should batch the expected number of requests", () => {
          expect(requestBody.requests.length).eql(3);
        });
      });

      describe("Safe mode", () => {
        const fixtures = [
          {title: "art1"},
          {title: "art2"},
        ];

        it("should forward the safe option to resulting requests", () => {
          return api.batch(batch => {
            for (const article of fixtures) {
              batch.createRecord("blog", article);
            }
          }, {safe: true})
            .then(_ => {
              const {requests} = JSON.parse(fetch.firstCall.args[1].body);
              expect(requests.map(r => r.headers))
                .eql([
                  {"If-None-Match": "*"},
                  {"If-None-Match": "*"},
                ]);
            });
        });
      });
    });

    describe("server response", () => {
      const fixtures = [
        { id: 1, title: "art1" },
        { id: 2, title: "art2" },
      ];

      it("should reject on HTTP 400", () => {
        sandbox.stub(root, "fetch").returns(fakeServerResponse(400, {
          error: true,
          errno: 117,
          message: "http 400"
        }));

        return executeBatch(fixtures)
          .should.eventually.be.rejectedWith(Error, /HTTP 400/);
      });

      it("should reject on HTTP error status code", () => {
        sandbox.stub(root, "fetch").returns(fakeServerResponse(500, {
          error: true,
          message: "http 500"
        }));

        return executeBatch(fixtures)
          .should.eventually.be.rejectedWith(Error, /HTTP 500/);
      });

      it("should expose succesful subrequest responses", () => {
        const responses = [
          { status: 201,
            path: `/${SPV}/buckets/blog/collections/articles/records`,
            body: { data: fixtures[0]}},
          { status: 201,
            path: `/${SPV}/buckets/blog/collections/articles/records`,
            body: { data: fixtures[1]}},
        ];
        sandbox.stub(root, "fetch")
          .returns(fakeServerResponse(200, {responses}));

        return executeBatch(fixtures)
          .should.eventually.become(responses);
      });

      it("should expose failing subrequest responses", () => {
        const missingRemotely = fixtures[0];
        const responses = [
          {
            status: 404,
            path: `/${SPV}/buckets/blog/collections/articles/records/1`,
            body: missingRemotely
          },
        ];
        sandbox.stub(root, "fetch")
          .returns(fakeServerResponse(200, {responses}));

        return executeBatch(fixtures)
          .should.eventually.become(responses);
      });

      it("should resolve with encountered HTTP 500", () => {
        const responses =  [
          {
            status: 500,
            path: `/${SPV}/buckets/blog/collections/articles/records/1`,
            body: { 500: true }
          },
        ];
        sandbox.stub(root, "fetch")
          .returns(fakeServerResponse(200, {responses}));

        return executeBatch(fixtures)
          .should.eventually.become(responses);
      });

      it("should expose encountered HTTP 412", () => {
        const responses = [
          {
            status: 412,
            path: `/${SPV}/buckets/blog/collections/articles/records/1`,
            body: {
              details: {
                existing: {title: "foo"}
              }
            }
          },
        ];
        sandbox.stub(root, "fetch")
          .returns(fakeServerResponse(200, {responses}));

        return executeBatch(fixtures)
          .should.eventually.become(responses);
      });
    });

    describe("Chunked requests", () => {
      // 4 operations, one more than the test limit which is 3
      const fixtures = [
        {id: 1, title: "foo"},
        {id: 2, title: "bar"},
        {id: 3, title: "baz"},
        {id: 4, title: "qux"},
      ];

      it("should chunk batch requests", () => {
        sandbox.stub(root, "fetch")
          .onFirstCall().returns(fakeServerResponse(200, {
            responses: [
              {status: 200, body: {data: 1}},
              {status: 200, body: {data: 2}},
              {status: 200, body: {data: 3}},
            ]
          }))
          .onSecondCall().returns(fakeServerResponse(200, {
            responses: [
              {status: 200, body: {data: 4}},
            ]
          }));
        return executeBatch(fixtures)
          .then(res => res.map(response => response.body.data))
          .should.become([1, 2, 3, 4]);
      });

      it("should not chunk batch requests if setting is falsy", () => {
        api.fetchServerSettings.returns(Promise.resolve({
          "batch_max_requests": null
        }));
        sandbox.stub(root, "fetch").returns(fakeServerResponse(200, {
          responses: []
        }));
        return executeBatch(fixtures)
          .then(_ => sinon.assert.calledOnce(fetch));
      });

      it("should map initial records to conflict objects", () => {
        sandbox.stub(root, "fetch")
          .onFirstCall().returns(fakeServerResponse(200, {
            responses: [
              {status: 412, body: {details: {existing: {id: 1}}}},
              {status: 412, body: {details: {existing: {id: 2}}}},
              {status: 412, body: {}},
            ]
          }))
          .onSecondCall().returns(fakeServerResponse(200, {
            responses: [
              {status: 412, body: {details: {existing: {id: 4}}}},
            ]
          }));
        return executeBatch(fixtures)
          .then(res => res.map(response => response.status))
          .should.become([412, 412, 412, 412]);
      });

      it("should chunk batch requests concurrently", () => {
        sandbox.stub(root, "fetch")
          .onFirstCall().returns(new Promise(resolve => {
            setTimeout(() => {
              resolve(fakeServerResponse(200, {
                responses: [
                  {status: 200, body: {data: 1}},
                  {status: 200, body: {data: 2}},
                  {status: 200, body: {data: 3}},
                ]
              }));
            }, 100);
          }))
          .onSecondCall().returns(new Promise(resolve => {
            setTimeout(() => {
              resolve(fakeServerResponse(200, {
                responses: [
                  {status: 200, body: {data: 4}},
                ]
              }));
            }, 5);
          }));
        return executeBatch(fixtures)
          .then(res => res.map(response => response.body.data))
          .should.become([1, 2, 3, 4]);
      });
    });

    describe("Aggregate mode", () => {
      const fixtures = [
        {title: "art1"},
        {title: "art2"},
        {title: "art3"},
        {title: "art4"},
      ];

      it("should resolve with an aggregated result object", () => {
        const responses = [];
        sandbox.stub(root, "fetch")
          .returns(fakeServerResponse(200, {responses}));
        const batchModule = require("../src/batch");
        const aggregate = sandbox.stub(batchModule, "aggregate");

        return executeBatch(fixtures, {aggregate: true})
          .then(_ => {
            sinon.assert.calledWith(aggregate, responses);
          });
      });
    });
  });

  /** @test {KintoClient#listBuckets} */
  describe("#listBuckets()", () => {
    const data = [{id: "a"}, {id: "b"}];

    beforeEach(() => {
      sandbox.stub(api, "execute").returns(Promise.resolve({
        json: {data}
      }));
    });

    it("should execute expected request", () => {
      api.listBuckets();

      sinon.assert.calledWithMatch(api.execute, {
        path: "/buckets",
      });
    });

    it("should support passing custom headers", () => {
      api.defaultReqOptions.headers = {Foo: "Bar"};
      api.listBuckets({headers: {Baz: "Qux"}});

      sinon.assert.calledWithMatch(api.execute, {
        headers: {Foo: "Bar", Baz: "Qux"}
      });
    });

    it("should resolve with a result object", () => {
      return api.listBuckets()
        .should.eventually.have.property("data").eql(data);
    });
  });

  /** @test {KintoClient#createBucket} */
  describe("#createBucket", () => {
    beforeEach(() => {
      sandbox.stub(requests, "createBucket");
      sandbox.stub(api, "execute").returns(Promise.resolve());
    });

    it("should execute expected request", () => {
      api.createBucket("foo");

      sinon.assert.calledWithMatch(requests.createBucket, "foo", {
        headers: {},
        safe: false,
      });
    });

    it("should accept a safe option", () => {
      api.createBucket("foo", {safe: true});

      sinon.assert.calledWithMatch(requests.createBucket, "foo", {
        safe: true
      });
    });

    it("should extend request headers with optional ones", () => {
      api.defaultReqOptions.headers = {Foo: "Bar"};

      api.createBucket("foo", {headers: {Baz: "Qux"}});

      sinon.assert.calledWithMatch(requests.createBucket, "foo", {
        headers: {Foo: "Bar", Baz: "Qux"}
      });
    });
  });

  /** @test {KintoClient#deleteBucket} */
  describe("#deleteBucket()", () => {
    beforeEach(() => {
      sandbox.stub(requests, "deleteBucket");
      sandbox.stub(api, "execute").returns(Promise.resolve());
    });

    it("should execute expected request", () => {
      api.deleteBucket("plop");

      sinon.assert.calledWithMatch(requests.deleteBucket, {id: "plop"}, {
        headers: {},
        safe: false,
      });
    });

    it("should accept a bucket object", () => {
      api.deleteBucket({id: "plop"});

      sinon.assert.calledWithMatch(requests.deleteBucket, {id: "plop"}, {
        headers: {},
        safe: false,
      });
    });

    it("should accept a safe option", () => {
      api.deleteBucket("plop", {safe: true});

      sinon.assert.calledWithMatch(requests.deleteBucket, {id: "plop"}, {
        safe: true
      });
    });

    it("should extend request headers with optional ones", () => {
      api.defaultReqOptions.headers = {Foo: "Bar"};

      api.deleteBucket("plop", {headers: {Baz: "Qux"}});

      sinon.assert.calledWithMatch(requests.deleteBucket, {id: "plop"}, {
        headers: {Foo: "Bar", Baz: "Qux"}
      });
    });
  });
});
