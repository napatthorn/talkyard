/**
 * Copyright (c) 2020 Kaj Magnus Lindberg
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

package talkyard.server.api

import com.debiki.core._
import controllers.OkApiJson
import Prelude._
import debiki.dao.{PageStuff, SiteDao}
import ed.server.search.{PageAndHits, SearchHit}
import play.api.libs.json._
import play.api.libs.json.JsArray
import play.api.mvc.Result
import talkyard.server.JsX._



object ThingsFoundJson {


  def makePagesFoundListResponse(topics: Seq[PagePathAndMeta], dao: SiteDao): Result = {
    makePagesFoundResponseImpl(topics, anySearchResults = Nil, dao)
  }


  def makePagesFoundSearchResponse(searchResults: Seq[PageAndHits], dao: SiteDao): Result = {
    makePagesFoundResponseImpl(anyPagePathsMetas = Nil, searchResults, dao)
  }


  // Vaguely similar code: ForumController.makeTopicsResponse()  [406RKD2JB]
  //
  private def makePagesFoundResponseImpl(
      anyPagePathsMetas: Seq[PagePathAndMeta], anySearchResults: Seq[PageAndHits],
      dao: SiteDao): Result = {

    dieIf(anyPagePathsMetas.nonEmpty && anySearchResults.nonEmpty, "TyE40RKUPJR2")

    val pageIds = (
      if (anyPagePathsMetas.nonEmpty) anyPagePathsMetas.map(_.pageId)
      else anySearchResults.map(_.pageId)).toSet

    // Stuff needed for creating the json — except for authors and categories.
    // Depending on if this is a ListQuery or a SearchQuery, we have different
    // things available already — let's load the remaining stuff:
    val pageFoundStuffs: Seq[PageFoundStuff] =
      if (anyPagePathsMetas.nonEmpty) {
        val pageStuffById = dao.getPageStuffById(pageIds)
        anyPagePathsMetas flatMap { pagePathMeta: PagePathAndMeta =>
          pageStuffById.get(pagePathMeta.pageId) map { pageStuff =>
             new PageFoundStuff(
               pagePath = pagePathMeta.path.toNew(
                 // I hope it's the canonical path? If not, barely matters.
                 canonical =  true),
               pageStuff = pageStuff,
               pageAndSearchHits = None)
          }
        }
      }
      else {
        anySearchResults map { pageAndHits =>
          new PageFoundStuff(
            pagePath = pageAndHits.pagePath,
            pageStuff = pageAndHits.pageStuff,
            pageAndSearchHits = Some(pageAndHits))
        }
      }

    val categoriesById: Map[CategoryId, Category] =
      pageFoundStuffs.flatMap(stuff =>
        stuff.pageMeta.categoryId flatMap dao.getCategory).groupByKeepOne(_.id)

    val authorIdsPages = pageFoundStuffs.map(_.pageStuff.authorUserId).toSet

    val postIdsFound = anySearchResults.flatMap(_.hitsByScoreDesc.map(_.postId))

    COULD_OPTIMIZE // cache authors by post id?
    val authorIdsByPostId = dao.loadAuthorIdsByPostId(postIdsFound.toSet)

    val ppIdsPagesPosts: Set[UserId] = authorIdsPages ++ authorIdsByPostId.values

    val authorsById = dao.getParticipantsAsMap(ppIdsPagesPosts)

    val siteIdsOrigins = dao.theSiteIdsOrigins()
    val avatarUrlPrefix =
      siteIdsOrigins.uploadsOrigin +
        ed.server.UploadsUrlBasePath + siteIdsOrigins.pubId + '/'

    val jsPagesFound: Seq[JsObject] = pageFoundStuffs map { stuff =>
      val anyCategory = stuff.pageMeta.categoryId.flatMap(categoriesById.get)
      JsPageFound(stuff, authorIdsByPostId, authorsById,
        avatarUrlPrefix = avatarUrlPrefix, anyCategory)
    }

    // Typescript: SearchQueryResults, and ListQueryResults
    OkApiJson(Json.obj(
      "origin" -> siteIdsOrigins.siteOrigin,
      "thingsFound" -> jsPagesFound))
  }


  // Things needed by JsPageFound().
  private class PageFoundStuff(
    val pagePath: PagePathWithId,
    val pageStuff: PageStuff,
    val pageAndSearchHits: Option[PageAndHits]) {
    def pageMeta: PageMeta = pageStuff.pageMeta
  }


  // Typescript: PageFound
  def JsPageFound(
        pageFoundStuff: PageFoundStuff,
        authorIdsByPostId: Map[PostId, UserId],
        authorsById: Map[UserId, Participant],
        avatarUrlPrefix: String,
        anyCategory: Option[Category]): JsObject = {

    val pageStuff = pageFoundStuff.pageStuff
    val anyPageAuthor = authorsById.get(pageStuff.authorUserId)

    // Category, author.  & search page too.
    var json = Json.obj(
      "pageId" -> pageStuff.pageId,
      "title" -> pageStuff.title,
      "urlPath" -> pageFoundStuff.pagePath.value,
      "excerpt" -> JsStringOrNull(pageStuff.bodyExcerpt),
      "author" -> JsParticipantFoundOrNull(anyPageAuthor, avatarUrlPrefix),
      "category" -> JsCategoryFoundOrNull(anyCategory))

    // If this is a SearchQuery for posts, include those posts.
    pageFoundStuff.pageAndSearchHits.foreach { pageAndHits: PageAndHits =>
      json += "postsFound" -> JsArray(pageAndHits.hitsByScoreDesc map { hit =>
        val anyAuthor: Option[Participant] =
          authorIdsByPostId.get(hit.postId) flatMap { authorId =>
            authorsById.get(authorId)
          }
        JsPostFound(hit, anyAuthor, avatarUrlPrefix)
      })
    }

    json
  }


  // Typescript: CategoryFound
  def JsCategoryFoundOrNull(anyCategory: Option[Category]): JsValue = {
    val category = anyCategory getOrElse { return JsNull }
    Json.obj(
      "name" -> JsString(category.name),
      "urlPath" -> JsString(s"/-${category.sectionPageId}"))
  }


  // Typescript: PostFound
  def JsPostFound(hit: SearchHit, anyAuthor: Option[Participant], avatarUrlPrefix: String)
        : JsObject = {
    Json.obj(
      "isPageTitle" -> JsBoolean(hit.postNr == PageParts.TitleNr),
      "isPageBody" -> JsBoolean(hit.postNr == PageParts.BodyNr),
      "author" -> JsParticipantFoundOrNull(anyAuthor, avatarUrlPrefix),
      "htmlWithMarks" -> JsArray(hit.approvedTextWithHighligtsHtml map JsString))
  }


   // Typescript: ParticipantFound
  def JsParticipantFoundOrNull(anyPp: Option[Participant], avatarUrlPrefix: String)
        : JsValue = {
    val pp = anyPp getOrElse { return JsNull }
    JsStringOrNull(pp.tinyAvatar.map(_.hashPath))
    Json.obj(
      "id" -> JsNumber(pp.id),
      "username" -> JsStringOrNull(pp.anyUsername),
      "fullName" -> JsStringOrNull(pp.anyName),
      "tinyAvatarUrl" -> JsStringOrNull(
        pp.tinyAvatar.map(avatarUrlPrefix + _.hashPath)),
      "isGroup" -> pp.isGroup,
      "isGuest" -> pp.isGuest)
  }

}


