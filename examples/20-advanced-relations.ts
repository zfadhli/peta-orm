// Peta ORM — 20-advanced-relations
// HasManyThrough, ManyToMany with pivot extras, MorphTo/MorphMany,
//   nested eager loading, Collection.load()

import { Database } from "bun:sqlite"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { $t, ArkTypeSchemaConfig, Collection, HasManyThrough, ManyToMany, Model, MorphMany, MorphTo, Peta } from "../src"

const t = $t({ schema: new ArkTypeSchemaConfig() })

// --- HasManyThrough ---
class Continent extends Model {
  static override table = "continents"
  static override columns = { id: t.integer().primaryKey(), name: t.string(255) }
  static override relations = {
    countries: new HasManyThrough(() => Country, () => ContinentCountry, { foreignKey: "continentId", throughForeignKey: "countryId" }),
  }
}

class ContinentCountry extends Model {
  static override table = "continent_countries"
  static override columns = { id: t.integer().primaryKey(), continentId: t.integer(), countryId: t.integer() }
}

class Country extends Model {
  static override table = "countries"
  static override columns = { id: t.integer().primaryKey(), name: t.string(255) }
}

// --- ManyToMany with pivot extras ---
class Team extends Model {
  static override table = "teams"
  static override columns = { id: t.integer().primaryKey(), name: t.string(255) }
  static override relations = {
    members: new ManyToMany(() => Member, { through: "team_members", foreignPivotKey: "teamId", relatedPivotKey: "memberId", pivotExtras: ["role"] }),
  }
}

class Member extends Model {
  static override table = "members"
  static override columns = { id: t.integer().primaryKey(), name: t.string(255) }
}

// --- Polymorphic morphs ---
class Post extends Model {
  static override table = "posts"
  static override columns = { id: t.integer().primaryKey(), title: t.string(255) }
  static override relations = { comments: new MorphMany(() => Comment, { morphId: "commentableId", morphType: "commentableType" }) }
}

class Photo extends Model {
  static override table = "photos"
  static override columns = { id: t.integer().primaryKey(), url: t.string(255) }
  static override relations = { comments: new MorphMany(() => Comment, { morphId: "commentableId", morphType: "commentableType" }) }
}

class Comment extends Model {
  static override table = "comments"
  static override columns = { id: t.integer().primaryKey(), body: t.text(), commentableId: t.integer(), commentableType: t.string(50) }
  static override relations = { parent: new MorphTo({ morphId: "commentableId", morphType: "commentableType" }) }
}

const database = new Database(":memory:")
database.run("CREATE TABLE continents (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)")
database.run("CREATE TABLE continent_countries (id INTEGER PRIMARY KEY AUTOINCREMENT, continentId INTEGER NOT NULL, countryId INTEGER NOT NULL)")
database.run("CREATE TABLE countries (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)")
database.run("CREATE TABLE teams (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)")
database.run("CREATE TABLE members (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)")
database.run("CREATE TABLE team_members (id INTEGER PRIMARY KEY AUTOINCREMENT, teamId INTEGER NOT NULL, memberId INTEGER NOT NULL, role TEXT)")
database.run("CREATE TABLE posts (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL)")
database.run("CREATE TABLE photos (id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT NOT NULL)")
database.run("CREATE TABLE comments (id INTEGER PRIMARY KEY AUTOINCREMENT, body TEXT NOT NULL, commentableId INTEGER NOT NULL, commentableType TEXT NOT NULL)")

const peta = new Peta({ dialect: new BunSqliteDialect({ database }) })
peta.registerAll(Continent, ContinentCountry, Country, Team, Member, Post, Photo, Comment)

// === HasManyThrough ===
const europe = await Continent.insert({ name: "Europe" })
const asia = await Continent.insert({ name: "Asia" })
const france = await Country.insert({ name: "France" })
const germany = await Country.insert({ name: "Germany" })
const japan = await Country.insert({ name: "Japan" })
await ContinentCountry.insert({ continentId: europe.get("id") as number, countryId: france.get("id") as number })
await ContinentCountry.insert({ continentId: europe.get("id") as number, countryId: germany.get("id") as number })
await ContinentCountry.insert({ continentId: asia.get("id") as number, countryId: japan.get("id") as number })

// Eager load HasManyThrough
const loadedContinent = await Continent.query().with("countries").where("id", "=", 1).execute()
console.log("HasManyThrough countries:", (loadedContinent[0]?.$getRelation("countries") as any[])?.length, "items")

// Or via $relatedQuery
const countries = await europe.$relatedQuery("countries").execute()
console.log("$relatedQuery countries:", countries.length)

// === ManyToMany with pivot extras ===
// Pivot extras accessed via $relatedQuery (not eager loading)
const devTeam = await Team.insert({ name: "Dev" })
const alice = await Member.insert({ name: "Alice" })
const bob = await Member.insert({ name: "Bob" })
await database.prepare("INSERT INTO team_members (teamId, memberId, role) VALUES (?, ?, ?)").run(devTeam.get("id") as number, alice.get("id") as number, "lead")
await database.prepare("INSERT INTO team_members (teamId, memberId, role) VALUES (?, ?, ?)").run(devTeam.get("id") as number, bob.get("id") as number, "dev")

const teamMembers = await devTeam.$relatedQuery("members").execute()
console.log("ManyToMany members:", teamMembers.length)

// === Polymorphic morphs ===
const post = await Post.insert({ title: "My Post" })
const photo = await Photo.insert({ url: "photo.jpg" })
await Comment.insert({ body: "Post comment", commentableId: post.get("id") as number, commentableType: "Post" })
await Comment.insert({ body: "Photo comment", commentableId: photo.get("id") as number, commentableType: "Photo" })

// Eager load morphs
const postWithComments = await Post.query().with("comments").execute()
console.log("MorphMany comments:", (postWithComments[0]?.$getRelation("comments") as any[])?.length)

// === Eager loading with constraints ===
const filteredPosts = await Post.query().with({ comments: (q) => q.where("body", "=", "Post comment") }).execute()
console.log("Eager with constraints:", filteredPosts.length, "posts")

// === Collection.load() ===
const allPosts = await Post.query().execute()
const col = new Collection(allPosts)
await col.load("comments")
console.log("Collection.load comments:", col.all().length, "posts")

await peta.destroy()
