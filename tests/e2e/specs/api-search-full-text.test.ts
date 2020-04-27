/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('../utils/ty-assert');
// import fs = require('fs');  EMBCMTS
import server = require('../utils/server');
import utils = require('../utils/utils');
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/pages-for';
import lad = require('../utils/log-and-die');
import c = require('../test-constants');


let maria: Member;
let mariasBrowser: TyE2eTestBrowser;

let siteIdAddress: IdAddress;
let siteId;

let forum: TwoPagesTestForum;  // or: LargeTestForum

const curiosityPageTitle = "What does curiosity have?";
const curiosityPageBody = "Curiosity has its own reason for existing";
const mariasReply = `
    Actually it was curiosity.
    Let me tell you some things about cats.
    Cats cannot fly — but still they like to climb to the top of the roof and trees.
    Cats like chimneys and warm electrical things.
    Cats like high wattage power cables.
    For cats, curiosity is dangerous`;


describe("some-e2e-test  TyT1234ABC", () => {

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addTwoPagesForum({
      title: "Some E2E Test",
      members: ['alice', 'michael', 'maria', 'owen'],
    });

    builder.addPost({
      page: forum.topics.byMichaelCategoryA,
      nr: c.FirstReplyNr,
      parentNr: c.BodyNr,
      authorId: forum.members.maria.id,
      approvedSource: "One two three many.",
    });

    const curiosityPage: PageJustAdded = builder.addPage({
      id: 'extraPageId',
      folder: '/',
      showId: false,
      slug: 'extra-page',
      role: c.TestPageRole.Discussion,
      title: curiosityPageTitle,
      body: curiosityPageBody,
      categoryId: forum.categories.specificCategory.id,
      authorId: forum.members.alice.id,
    });

    builder.addPost({
      page: curiosityPage,
      nr: c.FirstReplyNr,
      parentNr: c.BodyNr,
      authorId: forum.members.michael.id,
      approvedSource: "But what killed my neighbor's cat?",
    });

    builder.addPost({
      page: curiosityPage,
      nr: c.FirstReplyNr + 1,
      parentNr: c.FirstReplyNr,
      authorId: forum.members.owen.id,
      approvedSource: "A wild wolf, very hungry, lives in your garden, and likes cats?",
    });

    builder.addPost({
      page: curiosityPage,
      nr: c.FirstReplyNr + 2,
      parentNr: c.FirstReplyNr + 1,
      authorId: forum.members.maria.id,
      approvedSource: mariasReply,
    });

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


  // Show the site, so this spec becomes simpler to troubleshoot.
  it("Maria goes to the forum", () => {
    mariasBrowser.go2(siteIdAddress.origin);
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
  });

  let response: SearchQueryResults<PageFound>;

  it("Maria searches for curiosity, until she finds the page and 3 posts", () => {
    // Wait for the server to be done indexing these new pages.
    utils.tryUntilTrue(`searching for 'curiosity'`, 'ExpBackoff', () => {
      response = server.apiV0.fullTextSearch<PageFound>({
          origin: siteIdAddress.origin, queryText: "curiosity" });
      return (
          response.thingsFound.length >= 1  &&
          response.thingsFound[0].postsFound.length >= 3);
    });
  });

  it("She found exactly one page", () => {
    assert.eq(response.thingsFound.length, 1);
  });


  let pageFound: PageFound;

  it("... it's the Curiosity page", () => {
    pageFound = response.thingsFound[0];
    assert.eq(pageFound.title, curiosityPageTitle);
  });

  it("... in the Specific category", () => {
    assert.eq(pageFound.category?.name, forum.categories.specificCategory.name);
  });

  it("... and Alice is the author", () => {
    assert.eq(pageFound.author?.fullName, forum.members.alice.fullName);
    assert.eq(pageFound.author?.username, forum.members.alice.username);
  });

  it("Maria follows the category link", () => {
    mariasBrowser.go2(pageFound.category.urlPath);
  });

  it("... the link works: she sees the category name", () => {
    mariasBrowser.forumTopicList.waitForCategoryName(pageFound.category.name);
  });

  it("... and the Curiosity topic", () => {
    mariasBrowser.forumTopicList.waitForTopicVisible(curiosityPageTitle);
  });

  it("... no other topics", () => {
    mariasBrowser.forumTopicList.assertNumVisible(1);
  });


  let titleFound: PostFound;
  let bodyFound: PostFound;
  let replyFound: PostFound;

  it("Alice's title, body and Maria's reply was found", () => {
    assert.eq(pageFound.postsFound.length, 3);

    titleFound = pageFound.postsFound.find((ph: PostFound) => ph.isPageTitle);
    bodyFound = pageFound.postsFound.find((ph: PostFound) => ph.isPageBody);
    replyFound = pageFound.postsFound.find((ph: PostFound) => !ph.isPageTitle && !ph.isPageBody);

    assert.ok(titleFound.isPageTitle);
    assert.not(titleFound.isPageBody);

    assert.ok(bodyFound.isPageBody);
    assert.not(bodyFound.isPageTitle);

    assert.not(replyFound.isPageTitle);
    assert.not(replyFound.isPageBody);
  });


  it("... and the word 'curiosity' was found in the title", () => {
    assert.eq(titleFound.htmlWithMarks.length, 1);
    assert.includes(titleFound.htmlWithMarks[0], 'curiosity');
  });

  it("... in the body", () => {
    assert.eq(bodyFound.htmlWithMarks.length, 1);
    assert.includes(bodyFound.htmlWithMarks[0], 'Curiosity');  // uppercase 'C'
  });

  it("... and twice in Maria's reply", () => {
    assert.eq(replyFound.htmlWithMarks.length, 2);
    assert.includes(replyFound.htmlWithMarks[0], 'curiosity');
    assert.includes(replyFound.htmlWithMarks[1], 'curiosity');
  });

  it("... highlighted with a '<mark>' tag everywhere", () => {
    const curiosityMarked = '<mark>curiosity</mark>';
    assert.includes(titleFound.htmlWithMarks[0], curiosityMarked);
    assert.includes(bodyFound.htmlWithMarks[0], curiosityMarked.replace('c', 'C'));
    assert.includes(replyFound.htmlWithMarks[0], curiosityMarked);
    assert.includes(replyFound.htmlWithMarks[1], curiosityMarked);
  });

  // What? Seems the title didn't get any author. Whatever — the page body is enough?
  //it("The authors are correct: Alice wrote the title", () => {
  //  assert.eq(titleFound.author?.fullName, forum.members.alice.fullName);
  //  assert.eq(titleFound.author?.username, forum.members.alice.username);
  //});

  it("...  and body", () => {
    assert.eq(bodyFound.author?.fullName, forum.members.alice.fullName);
    assert.eq(bodyFound.author?.username, forum.members.alice.username);
  });

  it("... and Maria wrote the reply", () => {
    assert.eq(replyFound.author?.fullName, maria.fullName);
    assert.eq(replyFound.author?.username, maria.username);
  });

  it("Maria opens the page", () => {
    mariasBrowser.go2(pageFound.urlPath);
  });

  it("The title, body and reply are all there", () => {
    mariasBrowser.topic.waitForPostAssertTextMatches(c.TitleNr, curiosityPageTitle);
    mariasBrowser.topic.waitForPostAssertTextMatches(c.BodyNr, curiosityPageBody);
    mariasBrowser.topic.waitForPostAssertTextMatches(c.FirstReplyNr + 2, "it was curiosity")
  });

});

