/** @format */

const Role = require("./role.model");
const Department = require("./departmenat.model");
const Timezone = require("./timezone.model");
const Language = require("./language.model");
const Admin = require("./admin.model");
const User = require("./user.model");
const Profile = require("./profile.model");
const UserToken = require("./user-token.model");
const UserAttachment = require("./user-attachment.model");
const userLoginTiming = require("./user-login-timings.model");

const OTP = require("./otp.model");

const Genre = require("./genre.model");
const Book = require("./book.model");
const Chapter = require("./chapter.model");

const AssignBookEditor = require("./assignBookEditor.model");
const Payment = require("./payment.model");
const ContactUs = require("./contactUs.model");

const Ticket = require("./ticket.model");
const TicketMessage = require("./ticketMessage.model");
const BookSubmissionRequest = require("./book-submission-request.model");
const Feed = require("./feed.model");
const UserFeedComment = require("./user_feed_comment.model");
const UserFeedLike = require("./user_feed_like.model");
const Quote = require("./quotes.model");
const QuoteTag = require("./quotes_tags.model");
const QuoteTagMap = require("./quote_tag_map.model");
const UserCreditSpending = require("./user_credit_spending.model");
const UserCreditTransaction = require("./userCreditTransaction.model");

const { ChatRoom } = require("./chatRoom.model");
const { ChatParticipant } = require("./chatParticipant.model");

const UserSubscription = require("./userSubscription.model");
const ConversationMessage = require("./conversationMessage.model");
const Conversation = require("./conversation.model");

module.exports = {
  Role,
  Department,
  Timezone,
  Language,
  Admin,
  User,
  Profile,
  UserToken,
  UserAttachment,
  userLoginTiming,
  OTP,
  Genre,
  Book,
  Chapter,

  AssignBookEditor,
  Payment,
  ContactUs,

  Ticket,
  TicketMessage,
  BookSubmissionRequest,

  Feed,
  UserFeedComment,
  UserFeedLike,
  Quote,
  QuoteTag,
  QuoteTagMap,
  UserCreditSpending,
  UserCreditTransaction,

  ChatRoom,
  ChatParticipant,
  UserSubscription,

  Conversation,
  ConversationMessage,
};

async function initTableRelation() {
  // Department
  Department.hasMany(Admin, {
    foreignKey: "department_id",
    as: "department_admins",
  });
  Admin.belongsTo(Department, {
    foreignKey: "department_id",
    as: "admin_department",
  });
  // User
  Role.hasMany(Admin, { foreignKey: "role_id", as: "role_admins" });
  Admin.belongsTo(Role, { foreignKey: "role_id", as: "admin_role" });

  Role.hasMany(User, { foreignKey: "role_id", as: "role_users" });
  User.belongsTo(Role, { foreignKey: "role_id", as: "user_role" });

  User.hasOne(Profile, { foreignKey: "user_id", as: "user_profile" });
  Profile.belongsTo(User, { foreignKey: "user_id", as: "profile_user" });

  User.hasMany(UserAttachment, {
    foreignKey: "user_id",
    as: "user_attachments",
  });
  UserAttachment.belongsTo(User, {
    foreignKey: "user_id",
    as: "attachments_user",
  });

  User.hasMany(UserToken, { foreignKey: "user_id", as: "user_tokens" });
  UserToken.belongsTo(User, { foreignKey: "user_id", as: "token_user" });

  userLoginTiming.belongsTo(User, { foreignKey: "user_id", as: "login_user" });
  userLoginTiming.belongsTo(Timezone, {
    foreignKey: "time_zone",
    as: "login_user_timezone",
  });

  User.hasMany(Book, {
    foreignKey: "user_id",
    as: "user_books",
  });
  Book.belongsTo(User, {
    foreignKey: "user_id",
    as: "book_user",
  });

  Genre.hasMany(Book, {
    foreignKey: "genre_id",
    as: "genre_books",
  });
  Book.belongsTo(Genre, {
    foreignKey: "genre_id",
    as: "book_genre",
  });
  Book.hasMany(Chapter, {
    foreignKey: "book_id",
    as: "book_chapters",
  });
  Chapter.belongsTo(Book, {
    foreignKey: "book_id",
    as: "chapter_book",
  });
  Book.hasMany(AssignBookEditor, {
    foreignKey: "book_id",
    as: "book_editors",
  });

  AssignBookEditor.belongsTo(Admin, {
    foreignKey: "editor_id",
    as: "editor",
  });

  AssignBookEditor.belongsTo(Book, {
    foreignKey: "book_id",
    as: "assigned_book",
  });

  Admin.hasMany(AssignBookEditor, {
    foreignKey: "editor_id",
    as: "editor_assign_books",
  });
  User.hasMany(Payment, {
    foreignKey: "user_id",
    as: "user_payments",
  });
  Payment.belongsTo(User, {
    foreignKey: "user_id",
    as: "payment_user",
  });

  User.hasMany(UserSubscription, {
    foreignKey: "user_id",
    as: "user_subscriptions",
  });
  UserSubscription.belongsTo(User, {
    foreignKey: "user_id",
    as: "subscription_user",
  });

  Ticket.hasMany(TicketMessage, {
    foreignKey: "ticket_id",
    as: "ticket_messages",
  });
  TicketMessage.belongsTo(Ticket, {
    foreignKey: "ticket_id",
    as: "message_ticket",
  });

  // Ticket -> Admin
  Ticket.belongsTo(Admin, {
    foreignKey: "assigned_to",
    as: "assigned_admin",
  });

  // (Optional reverse relation)
  Admin.hasMany(Ticket, {
    foreignKey: "assigned_to",
    as: "tickets",
  });

  Book.hasMany(BookSubmissionRequest, {
    foreignKey: "book_id",
    as: "book_submissions",
  });
  BookSubmissionRequest.belongsTo(Book, {
    foreignKey: "book_id",
    as: "submission_book",
  });

  User.hasMany(Feed, {
    foreignKey: "user_id",
    as: "user_feeds",
  });
  Feed.belongsTo(User, {
    foreignKey: "user_id",
    as: "feed_user",
  });

  User.hasMany(UserFeedComment, {
    foreignKey: "user_id",
    as: "user_feed_comments",
  });
  UserFeedComment.belongsTo(User, {
    foreignKey: "user_id",
    as: "feed_comment_user",
  });

  // Feed Comment Self Association (Replies)
  UserFeedComment.hasMany(UserFeedComment, {
    foreignKey: "parent_id",
    as: "replies",
  });

  UserFeedComment.belongsTo(UserFeedComment, {
    foreignKey: "parent_id",
    as: "parent",
  });

  Quote.belongsToMany(QuoteTag, {
    through: "quote_tag_map",
    foreignKey: "quote_id",
    otherKey: "tag_id",
  });

  QuoteTag.belongsToMany(Quote, {
    through: "quote_tag_map",
    foreignKey: "tag_id",
    otherKey: "quote_id",
  });

  Feed.hasMany(UserFeedComment, {
    foreignKey: "feed_id",
    as: "replies",
  });

  UserFeedComment.belongsTo(Feed, {
    foreignKey: "feed_id",
    as: "feed",
  });

  Feed.hasMany(UserFeedLike, {
    foreignKey: "feed_id",
    as: "feed_likes",
  });

  UserFeedLike.belongsTo(Feed, {
    foreignKey: "feed_id",
    as: "liked_feed",
  });

  User.hasMany(UserFeedLike, {
    foreignKey: "user_id",
    as: "user_likes",
  });

  UserFeedLike.belongsTo(User, {
    foreignKey: "user_id",
    as: "liked_user",
  });

  Feed.belongsTo(Genre, {
    foreignKey: "genre_id",
    as: "feed_genre",
  });

  Genre.hasMany(Feed, {
    foreignKey: "genre_id",
    as: "genre_feeds",
  });

  User.hasMany(UserCreditSpending, {
    foreignKey: "user_id",
    as: "user_credits",
  });

  ChatRoom.hasMany(ChatParticipant, {
    foreignKey: "chat_room_id",
    as: "participants",
  });

  ChatParticipant.belongsTo(ChatRoom, {
    foreignKey: "chat_room_id",
    as: "chat_room",
  });

  ChatParticipant.belongsTo(User, {
    foreignKey: "user_id",
    as: "user_details",
  });

  ChatParticipant.belongsTo(Admin, {
    foreignKey: "user_id",
    as: "admin_details",
  });

  Book.hasOne(ChatRoom, {
    foreignKey: "book_id",
    as: "book_chat_room",
  });
  ChatRoom.belongsTo(Book, {
    foreignKey: "book_id",
    as: "book_details",
  });

  ChatRoom.belongsTo(Admin, {
    foreignKey: "created_by",
    as: "chat_participant_ad",
  });

  Ticket.belongsTo(User, {
    foreignKey: "user_id",
    as: "ticket_user",
  });

  User.hasMany(Ticket, {
    foreignKey: "user_id",
    as: "user_tickets",
  });

  Conversation.hasMany(ConversationMessage, {
    foreignKey: "conversation_id",
    as: "messages",
  });

  ConversationMessage.belongsTo(Conversation, {
    foreignKey: "conversation_id",
    as: "conversation",
  });
}

/* Only Uncomment when data migration will complete */
initTableRelation();
