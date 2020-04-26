
// Public API Typescript types. [PUB_API]
//
// These shouldn't be used by the Talkyard client itself — because if
// the Ty client were to use the public stable API, there'd be a
// slightly higher risk that the Ty developers accidentally changed
// the public API just because the Talkyard client needed some
// API changes?  Instead, the Ty client uses an internal API that
// it's fine to change in any way at any time.
//
// ... So this file is placed in <root>/tests/... where the Talkyard
// client (located in <root>/client/) cannot access it.


// Old, deprecated?
interface ListUsersApiResponse {
  // RENAME to thingsFound?
  users: UserFound[];
}


// Misc types
// -------------------------

type ApiResponse<R> = ApiErrorResponse | R;

type ApiErrorResponse = { error: any; };

type ParticipantId = string;

type MemberRef = string;
type CategoryRef = string;
type TagRef = string;
type BadgeRef = string;

type SortOrder = 'popular_first' | 'active_first' | 'newest_first';

type Unimplemented = undefined;


/*
// When finding, say, pages, the page authors are not included in the
// thingsFound[] list. Instead, the authors are  included in a
// ReferencedThings object — then, each author needs to be included
// only once, even though they might have written many of the pages found.
//
interface ReferencedThings {
  participantsById: { [id: string]: Participant_ };
}

function testA() { return (null as Participant_).class === '' + Date.now(); }
function testB() { return (null as Participant_).interface === '' + Date.now(); }
function testC() { return (null as Participant_).type === '' + Date.now(); }

interface Participant_ {
  interface: '123test is interface always a keyword?';
  type: 'im a type';
  class: 'hmm?';
  id: UserId;
  fullName?: string;
  username?: string;
  avatarUrl?: string;
  isGroup?: boolean;
  isGuest?: boolean;
} */


// What you're looking for
// -------------------------

// The different things Search Queries and List Queries can find:

type FindWhat =
  'pages' |

  // Users and groups (not guests).
  'members' |

  // Users, groups, guests.
  'participants' |

  // Maybe you don't remember if you invited someone, and want to find
  // any invite with the relevant email address.
  'invites' |

  // Maybe you wonder if a reply notification email got sent or not — maybe your
  // mail server was offline for a while.
  'emails_sent' |

  // If you have many tags, and want to find a tag via its About text or title.
  'tags' |

  // If you have many categories so you need to search & find.
  'categories' |

  // If you want to find a user badge, by searching badge titles or about texts.
  'badges';



// Where to search
// -------------------------

// In which text fields or content sections to look, when searching for things,
// or listing things.
//
interface LookWhere {
  // E.g for autocompleting a username, when @mentioning someone.
  usernames?: boolean;

  // Users, groups and guests can have full names.
  fullNames?: boolean;

  emailAddresses?: boolean;

  // Find members in these groups.
  inGroups: MemberRef[];

  // Find members with these badges.
  withBadges: BadgeRef[];

  // About a user / group,  or category, or tag, or user badge.
  aboutText?: boolean;

  // Search page titles, or tag titles, or user badge titles, or email subject lines.
  titleText?: boolean;

  // Searches the page body (original post) only, not the title, not any replies.
  // Or an email body (not subject line).
  bodyText?: boolean;

  // Searches replies, but not page title or body (original post).
  repliesText?: boolean;

  // Searches everything: Page tite, body, and replies.
  pageText?: boolean;

  // If you want to search only, say, pages of type Article and Question.
  pageTypes?: PageType[];

  // Find pages in these categories.
  inCategories: CategoryRef[];

  // Pages with these tags.
  withTags: TagRef[];

  // Posts written by these users or groups.
  writtenBy: MemberRef[];
};


// What you get back
// -------------------------

type ThingFound = PageFound | ParticipantFound | TagFound | CategoryFound;


interface ParticipantFound {
  id: ParticipantId;
  fullName?: string;
}

interface GuestFound extends ParticipantFound {
  fullName: string;
}

interface MemberFound extends ParticipantFound {
  username: string;
  isGroup?: boolean;
}

interface UserFound extends MemberFound {
  isGroup?: false;
}

interface GroupFound extends MemberFound {
  isGroup: true;
}



interface PageFound {
  pageTitle: string;
  urlPath: string;
  author?: ParticipantFound;
  postsFound?: PostFound[];
  categoryFound?: CategoryFound;
}

interface PostFound {
  isPageTitle?: boolean;
  isPageBody?: boolean;
  author?: ParticipantFound;
  htmlWithMarks: string[];
}


type TagFound = Unimplemented;


interface CategoryFound {
  name: string;
  urlPath: string;
};



// A  List Query request
// -------------------------


// List Queries are comparatively fast — they lookup things directly, via indexes in
// the PostgreSQL database.  However they cannot do full text search — for that,
// you need a Search Query.
//
interface ListQueryApiRequest {
  // Either:
  listQuery?: ListQuery;
  sortOrder?: SortOrder;

  // Or:
  continueAtScrollCursor?: ListResultsScrollCursor;

  limit?: number;
  pretty?: boolean;
}

interface ListQuery {
  exactPrefix?: string;
  findWhat: FindWhat,
  lookWhere: LookWhere;
}

type ListQueryApiResponse<T extends ThingFound> = ApiResponse<ListQueryResults<T>>;

interface ListQueryResults<T extends ThingFound> {
  thingsFound?: T[];
  scrollCursor?: ListResultsScrollCursor;
}

type ListResultsScrollCursor = Unimplemented;


// Examples:
//
// Auto-complete username "jane_doe" when typing a username prefix:
//
//  /-/v0/list  {
//    listQuery: {
//      exactPrefix: 'jane_d',
//      findWhat: 'members',
//      lookWhere: { usernames: true },
//    }
//  }
//
// List popular pages in a category:
//
//  /-/v0/list  {
//    listQuery: {
//      findWhat: 'pages',
//      lookWhere: { inCategories: [categoryA, catB, catC] },
//    }
//    sortOrder: 'popular_first',
//    limit: 5,
//  }



// A  Search Query request
// -------------------------


interface SearchQueryApiRequest {
  // Either:
  searchQuery?: SearchQuery2;

  // Or:
  continueAtScrollCursor?: SearchResultsScrollCursor;

  limit?: number;
  pretty?: boolean;
}

type SearchQuery2 = SinglSearchQuery | CompoundSearchQuery;

type CompoundSearchQuery =
  // All must match. (But this not yet implemented.)
  SinglSearchQuery[];

interface SinglSearchQuery {
  freetext?: string;
  findWhat: FindWhat,
  lookWhere: LookWhere;
};

type SearchQueryApiResponse<T extends ThingFound> = ApiResponse<SearchQueryResults<T>>;

interface SearchQueryResults<T extends ThingFound> {
  thingsFound?: T[];
  scrollCursor?: SearchResultsScrollCursor;
}

type SearchResultsScrollCursor = Unimplemented;


// Examples:
//
//  /-/v0/search  {
//    searchQuery: { freetext: "how climb a tree" }
//  }
//
// The above is the same as:
//
//  /-/v0/search  {
//    searchQuery: {
//      freetext: 'how climb a tree',
//      findWhat: 'pages',             // the default
//      lookWhere: { pageText: true }. // the default, when finding pages
//    }
//  }
//
// Find a user:
//
//  /-/v0/search  {
//    searchQuery: {
//      freetext: 'jane',
//      findWhat: 'members',
//      lookWhere: { usernames: true, fullNames: true }  // the default, when finding users
//    }
//  }
//
// This compound query finds posts about how to climb a tree, written by someone
// with "Doe" in their name:
//
//  /-/v0/search  {
//    searchQuery: [{
//      freetext: 'Doe',
//      findWhat: 'members',
//    }, {
//      freetext: 'trees',
//      findWhat: 'pages',
//    }]
//  }
//
// The above is useful, if you remember that, say, someone with a name like "Doe"
// wrote something about trees. You might then find out that Jane Doe wrote an article
// about how to climb trees. The search result would include a UserFound
// and a PageFound ?? (not implemented, not decided)
//
// ( ElasticSearch compound queries docs:
//  https://www.elastic.co/guide/en/elasticsearch/reference/current/compound-queries.html
//  — the example above Jane Doe and "trees" is a query of type: bool must match.
//  Others, like Toshi + Tantivy — yes, supports compound queries:
//   https://github.com/toshi-search/Toshi#boolean-query
//  PostgreSQL built-in search: I'd think so — "just" join tables?
//  Meilisearch: https://www.meilisearch.com — doesn't seem to support this. )
//
// However if you already know who wrote something about trees, then, don't
// search for that person — instead use LookWhere.writtenBy:
//
//  /-/v0/search  {
//    searchQuery: {
//      freetext: 'climb trees',
//      lookWhere: { pageText: true, writtenBy: 'username:jane_doe' },
//    }
//  }
//


