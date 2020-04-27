/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('../utils/ty-assert');
// import fs = require('fs');  EMBCMTS
import server = require('../utils/server');
import utils = require('../utils/utils');
import settings = require('../utils/settings');
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/pages-for';
import lad = require('../utils/log-and-die');
import c = require('../test-constants');


let maria: Member;
let mariasBrowser: TyE2eTestBrowser;

let margaret: Member;

let siteIdAddress: IdAddress;
let siteId;

let forum: TwoPagesTestForum;  // or: LargeTestForum

const specificCatExtId = 'specificCatExtId';
const staffCatExtId = 'staffCatExtId';

const pageOneTitle = 'pageOneTitle';
const pageOneBody = 'pageOneBody';
let pageOneJustAdded: PageJustAdded | U;

const margaretsPageTitle = "What happened";
const margaretsPageBody =
    `Software eventually and necessarily gained the same respect as any other discipline`;
let margaretsPageJustAdded: PageJustAdded | U;

const pageThreeTitle = 'pageThreeTitle';
const pageThreeBody = 'pageThreeBody';
let pageThreeJustAdded: PageJustAdded | U;


describe("some-e2e-test  TyT1234ABC", () => {

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addTwoPagesForum({
      title: "Some E2E Test",
      members: ['michael', 'maria', 'owen'],
    });

    margaret = builder.addMmember('margaret');

    pageOneJustAdded = builder.addPage({
      id: 'pageOneId',
      folder: '/',
      showId: false,
      slug: 'page-one',
      role: c.TestPageRole.Discussion,
      title: pageOneTitle,
      body: pageOneBody,
      categoryId: forum.categories.specificCategory.id,
      authorId: forum.members.maria.id,
    });

    margaretsPageJustAdded = builder.addPage({
      id: 'pageTwoId',
      folder: '/',
      showId: false,
      slug: 'page-two',
      role: c.TestPageRole.Discussion,
      title: margaretsPageTitle,
      body: margaretsPageBody,
      categoryId: forum.categories.specificCategory.id,
      authorId: margaret.id,
    });

    pageThreeJustAdded = builder.addPage({
      id: 'pageThreeId',
      folder: '/',
      showId: false,
      slug: 'page-three',
      role: c.TestPageRole.Discussion,
      title: pageThreeTitle,
      body: pageThreeBody,
      categoryId: forum.categories.specificCategory.id,
      authorId: forum.members.michael.id,
    });

    forum.categories.specificCategory.extId = specificCatExtId;

    builder.getSite().isTestSiteIndexAnyway = true;

    assert.refEq(builder.getSite(), forum.siteData);
    siteIdAddress = server.importSiteData(forum.siteData);
    siteId = siteIdAddress.id;
    server.skipRateLimits(siteId);
  });

  it("initialize people", () => {
    const richBrowserA = new TyE2eTestBrowser(oneWdioBrowser);
    maria = forum.members.maria;
    mariasBrowser = richBrowserA;
  });


  it("Maria goes to the forum, logs in", () => {
    mariasBrowser.go2(siteIdAddress.origin);
    // Log in, so can Like vote, later below.
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
  });


  // ----- List Query: Active topics first

  // Since no Like votes, the most recently active topics should be listed first.

  let response: SearchQueryResults<PageFound>;

  it("Maria lists pages in the Specific category", () => {
    response = server.apiV0.listQuery<PageFound>({
      origin: siteIdAddress.origin,
      listQuery: {
        findWhat: 'pages',
        lookWhere: { inCategories: [`extid:${specificCatExtId}`] },
      },
    });
  });

  it("She finds three pages", () => {
    assert.eq(response.thingsFound.length, 3);
  });


  let pageOneFound: PageFound;
  let pageTwoFound: PageFound;
  let pageThreeFound: PageFound;

  it("The first page is the most recent one, Page Three  [TyT025WKRGJ]", () => {
    pageOneFound = response.thingsFound[0];
    assert.eq(pageOneFound.title, pageThreeTitle);
  });

  it("The second is Margaret's page", () => {
    pageTwoFound = response.thingsFound[1];
    assert.eq(pageTwoFound.title, margaretsPageTitle);
  });

  it("The third page in the topics list, is the first page added", () => {
    pageThreeFound = response.thingsFound[2];
    assert.eq(pageThreeFound.title, pageOneTitle);
  });

  it("All of them are in the Specific category", () => {
    assert.eq(pageOneFound.category?.name,   forum.categories.specificCategory.name);
    assert.eq(pageTwoFound.category?.name,   forum.categories.specificCategory.name);
    assert.eq(pageThreeFound.category?.name, forum.categories.specificCategory.name);
  });

  //it("... and Alice is the author", () => {
  //  assert.eq(pageOneFound.author?.fullName, forum.members.alice.fullName);
  //  assert.eq(pageOneFound.author?.username, forum.members.alice.username);
  //});

  it("Maria opens Margaret's page", () => {
    mariasBrowser.go2(pageTwoFound.urlPath);
  });

  it("The title, body and reply are all there", () => {
    mariasBrowser.topic.waitForPostAssertTextMatches(c.TitleNr, margaretsPageTitle);
    mariasBrowser.topic.waitForPostAssertTextMatches(c.BodyNr, margaretsPageBody);
  });


  // ----- Popular First


  it("Maria clicks Like", () => {
    mariasBrowser.topic.clickLikeVote(c.BodyNr);
  });

  it("Maria again lists pages in the Specific category", () => {
    response = server.apiV0.listQuery<PageFound>({
      origin: siteIdAddress.origin,
      listQuery: {
        findWhat: 'pages',
        lookWhere: { inCategories: [`extid:${specificCatExtId}`] },
      },
    });
  });

  it("She again finds three pages", () => {
    assert.eq(response.thingsFound.length, 3);
  });

  it("But now Margaret's page is first — it got a Like vote", () => {
    pageOneFound = response.thingsFound[0];
    assert.eq(pageOneFound.title, margaretsPageTitle);
  });

  it("The last page added, comes thereafter", () => {
    pageTwoFound = response.thingsFound[1];
    assert.eq(pageTwoFound.title, pageThreeTitle);
  });

  it("The and the first page added, is last", () => {
    pageThreeFound = response.thingsFound[2];
    assert.eq(pageThreeFound.title, pageOneTitle);
  });


  // ----- Private topics stay private


  it("Maria tries to list pages in the Staff category", () => {
mariasBrowser.debug();
    response = server.apiV0.listQuery<PageFound>({
      origin: siteIdAddress.origin,
      listQuery: {
        findWhat: 'pages',
        lookWhere: { inCategories: [`extid:${staffCatExtId}`] },
      },
    });
  });

  it("... but she cannot see those pages", () => {
    if (response.thingsFound.length >= 1) {
      assert.fail(`Found staff pages, response:\n${JSON.stringify(response)}`);
    }
  });

  // Later: The same query, as Owen / a staff member.  TESTS_MISSING
  //
  // But as of now — this API is for public pages only.
  //

});

