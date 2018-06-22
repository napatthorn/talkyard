/**
 * Copyright (C) 2015 Kaj Magnus Lindberg
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

package com.debiki.core

import com.debiki.core.Prelude._
import java.{util => ju}
import scala.collection.immutable


case class ReviewTaskCounts(numUrgent: Int, numOther: Int)


sealed abstract class ReviewDecision(val IntVal: Int) {
  def toInt: Int = IntVal
  def isFine: Boolean = IntVal <= ReviewDecision.LastAcceptId
  def isRejectionBadUser: Boolean = IntVal >= ReviewDecision.FirstBadId
}


object ReviewDecision {
  val UndoTimoutSeconds = 15 // sync with Typescript [2PUKQB0]

  // 1nnn = Accept
  case object Accept extends ReviewDecision(1001)
  private val LastAcceptId = 1999

  // 3nnn = Request changes.
  // ... later ...

  // 5nnn = Reject.
  private val FirstBadId = 5000
  case object DeletePostOrPage extends ReviewDecision(5001)

  def fromInt(value: Int): Option[ReviewDecision] = Some(value match {
    case ReviewDecision.Accept.IntVal => ReviewDecision.Accept
    case ReviewDecision.DeletePostOrPage.IntVal => ReviewDecision.DeletePostOrPage
    case _ => return None
  })
}


/** Means that something should be reviewed, e.g. a post or a user should be reviewed.
  *
  * @param createdById The user that created the review task, e.g. someone who flagged a post.
  *   Is part of a unique key. So if, for example, someone posts spam, and two different people
  *   flag the spam post — then three review tasks might get created: one with causedById =
  *   the system user, with review-reason = spam-detected. And one for each flagger; these
  *   tasks will have review reason = post-was-flagged-as-spamm.
  * @param decidedAt When an admin makse a review decision, the review task isn't
  *   completed immediately. Instead, it's scheduled to happen maybe 10 seconds into the future.
  *   And if the admin clicks an Undo button, before these 10 seconds have elapsed,
  *   then the review decision gets cancelled.
  *   (Review decisions generally cannot be undone, [REVIEWUNDO]
  *   because after they've been made, additional posts by the same author, might
  *   get auto approved, and/or other people might reply to the approved posts, and it's
  *   not obvious what a one-click Undo would do to all those auto-approved posts and replies.)
  * @param decidedById The staff user that had a look at this review task and e.g. deleted
  *   a spam comment, or dismissed the review task if the comment was ok.
  * @param invalidatedAt If there is e.g. a review task about a comment, but the comment gets
  *   deleted, then the review task becomes invalid. Perhaps just delete the review task instead?
  *   Hmm. StackExchange has an invalidated_at field. Aha, could be useful if the comment gets
  *   undeleted — then we want the review task back again.
  * @param maybeBadUserId A user that did something possibly harmful and therefore what s/he did
  *   should be reviewed. E.g. wrote a post that got flagged. Or changed his/her avatar
  *   and his/her profile, which therefore should be reviewed.
  * @param pageId A new page that should be reviewed.
  * @param postId A post that should be reviewed, it might be spam for example.
  */
case class ReviewTask(
  id: ReviewTaskId,
  reasons: immutable.Seq[ReviewReason],
  createdById: UserId,
  createdAt: ju.Date,
  createdAtRevNr: Option[Int] = None,
  moreReasonsAt: Option[ju.Date] = None,
  decidedAt: Option[ju.Date] = None,
  completedAt: Option[ju.Date] = None,
  decidedAtRevNr: Option[Int] = None,
  decidedById: Option[UserId] = None,
  invalidatedAt: Option[ju.Date] = None,
  decision: Option[ReviewDecision] = None,
  // COULD change to a Set[UserId] and include editors too, hmm. [6KW02QS]  Or just the author +
  // the 10? most recent editors, or the 10 most recent editors (not the author) for wiki posts.
  // Or the ones who edited the post, since it was last reviewed & any flags disagreed with?
  maybeBadUserId: UserId,
  // Only if is for both title and body (cannot currently be moved to different page).
  pageId: Option[PageId] = None,
  postId: Option[PostId] = None,
  postNr: Option[PostNr] = None) {

  require(reasons.nonEmpty, "EsE3FK21")
  require(!moreReasonsAt.exists(_.getTime < createdAt.getTime), "EsE7UGYP2")
  require(!decidedAt.exists(_.getTime < createdAt.getTime), "TyE6UHQ21")
  require(!completedAt.exists(_.getTime < createdAt.getTime), "EsE0YUL72")
  require(!invalidatedAt.exists(_.getTime < createdAt.getTime), "EsE5GKP2")
  require(completedAt.isEmpty || invalidatedAt.isEmpty, "EsE2FPW1")
  require((decidedAt.isEmpty && completedAt.isEmpty) || decision.isDefined, "EsE0YUM4")
  require(!decidedAtRevNr.exists(_ < FirstRevisionNr), "EsE1WL43")
  require(!postId.exists(_ <= 0), "EsE3GUL80")
  // pageId defined = is for title & body.
  require(pageId.isEmpty || (postId.isDefined && postNr.is(PageParts.BodyNr)), "EsE6JUM12")
  require(postId.isDefined == postNr.isDefined, "EsE6JUM13")
  require(postId.isDefined == createdAtRevNr.isDefined, "EsE5PUY0")
  require(postId.isEmpty || (
      decidedAt.isDefined || completedAt.isDefined) == decidedAtRevNr.isDefined, "EsE4PU2")


  /** If the review decision has been carried out, or if the review task became obsolete. */
  def doneOrGone: Boolean = completedAt.isDefined || invalidatedAt.isDefined

  def isForBothTitleAndBody: Boolean = pageId.isDefined

  def mergeWithAny(anyOldTask: Option[ReviewTask]): ReviewTask = {
    val oldTask = anyOldTask getOrElse {
      return this
    }
    require(oldTask.id == this.id, "EsE4GPMU0")
    require(oldTask.completedAt.isEmpty, "EsE4FYC2")
    require(oldTask.createdById == this.createdById, "EsE6GU20")
    require(oldTask.createdAt.getTime <= this.createdAt.getTime, "EsE7JGYM2")
    require(!oldTask.moreReasonsAt.exists(_.getTime > this.createdAt.getTime), "EsE2QUX4")
    require(oldTask.maybeBadUserId == this.maybeBadUserId, "EsE5JMU1")
    require(oldTask.postId == this.postId, "EsE2UYF7")
    // Cannot add more review reasons to an already completed task.
    require(oldTask.completedAt.isEmpty, "EsE1WQC3")
    require(oldTask.invalidatedAt.isEmpty, "EsE7UGMF2")
    val newReasonsValue = ReviewReason.toLong(oldTask.reasons) + ReviewReason.toLong(this.reasons)
    val newReasonsSeq = ReviewReason.fromLong(newReasonsValue)
    this.copy(
      reasons = newReasonsSeq,
      createdAt = oldTask.createdAt,
      moreReasonsAt = Some(this.createdAt))
  }

}



/* Keep for a while, mentioned in ReviewReason. [L4KDUQF2]
object ReviewTaskResolution {

  val Fine = new ReviewTaskResolution(1)

  // ...Other was-approved-because-... details bits?

  val Harmful = new ReviewTaskResolution(1 << 10)

  // Other was-rejected-because-... details bits?
  // 1 << 20 ... = more details, like user banned, or marked as threat or whatever else one can do?

  def requireIsValid(resolution: ReviewTaskResolution) {
    val value = resolution.value
    require(value != 0, "EsE5JUK020")
    require(!(resolution.isFine && resolution.isHarmful), "EsE8YKJF2")
    // for now: (change later when needed)
    require(value == Fine.value, s"Bad value: $value [EsE7YKP02]")
  }
}


class ReviewTaskResolution(val value: Int) extends AnyVal {
  import ReviewTaskResolution._

  def toInt: Int = value

  def isFine: Boolean = (value & Fine.value) != 0
  def isHarmful: Boolean = (value & Harmful.value) != 0

} */
