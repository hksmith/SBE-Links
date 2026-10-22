// Tiny in-memory stand-in for the subset of the MongoDB driver this app uses.
// Lets the tests (and a demo server) run without a MongoDB instance.
const clone = v => {
  if (Buffer.isBuffer(v)) return Buffer.from(v);
  if (Array.isArray(v)) return v.map(clone);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clone(x)]));
  return v;
};
const getPath = (o, p) => p.split('.').reduce((x, k) => (x == null ? undefined : x[k]), o);
const setPath = (o, p, v) => { const ks = p.split('.'), l = ks.pop(); const t = ks.reduce((x, k) => (x[k] ??= {}), o); t[l] = v; };

function matches(doc, filter) {
  return Object.entries(filter || {}).every(([k, cond]) => {
    const v = getPath(doc, k);
    if (cond && typeof cond === 'object' && !Array.isArray(cond) && Object.keys(cond).some(x => x.startsWith('$'))) {
      return Object.entries(cond).every(([op, x]) => {
        switch (op) {
          case '$gte': return v >= x;
          case '$gt': return v > x;
          case '$lte': return v <= x;
          case '$lt': return v < x;
          case '$ne': return v !== x;
          case '$in': return x.includes(v);
          case '$nin': return !x.includes(v);
          default: throw new Error('fake-mongo: unsupported operator ' + op);
        }
      });
    }
    if (cond === null) return v === null || v === undefined; // like MongoDB: null also matches a missing field
    return v === cond;
  });
}

function dupError() { const e = new Error('E11000 duplicate key'); e.code = 11000; return e; }

class Cursor {
  constructor(docs, projection) { this.docs = docs; this.projection = projection; }
  sort(spec) {
    const [[k, dir]] = Object.entries(spec);
    this.docs.sort((a, b) => (getPath(a, k) > getPath(b, k) ? dir : getPath(a, k) < getPath(b, k) ? -dir : 0));
    return this;
  }
  limit(n) { this.docs = this.docs.slice(0, n); return this; }
  async toArray() {
    const p = this.projection;
    return this.docs.map(d => {
      d = clone(d);
      if (!p) return d;
      const inc = Object.entries(p).filter(([k, v]) => v && k !== '_id').map(([k]) => k);
      const out = inc.length ? Object.fromEntries(inc.filter(k => k in d).map(k => [k, d[k]])) : d;
      if (inc.length && p._id !== 0) out._id = d._id;
      if (p._id === 0) delete out._id;
      return out;
    });
  }
}

class Collection {
  constructor() { this.docs = []; this.unique = []; this.seq = 0; }
  _checkUnique(doc, except) {
    for (const d of this.docs) {
      if (d === except) continue;
      if (d._id === doc._id) throw dupError();
      for (const fs of this.unique) {
        if (fs.length === 1 && getPath(d, fs[0]) === undefined) continue;
        if (fs.every(f => (getPath(d, f) ?? null) === (getPath(doc, f) ?? null))) throw dupError();
      }
    }
  }
  async createIndex(spec, opts = {}) { if (opts.unique) this.unique.push(Object.keys(spec)); }
  async dropIndex() { throw new Error('index not found'); }
  find(filter, opts = {}) { return new Cursor(this.docs.filter(d => matches(d, filter)), opts.projection); }
  async findOne(filter) { const d = this.docs.find(x => matches(x, filter)); return d ? clone(d) : null; }
  async countDocuments(filter) { return this.docs.filter(d => matches(d, filter)).length; }
  async insertOne(doc) {
    doc = clone(doc);
    if (doc._id === undefined) doc._id = 'oid' + ++this.seq;
    this._checkUnique(doc);
    this.docs.push(doc);
    return { insertedId: doc._id };
  }
  async insertMany(docs) { for (const d of docs) await this.insertOne(d); return { insertedCount: docs.length }; }
  async replaceOne(filter, doc) {
    const i = this.docs.findIndex(d => matches(d, filter));
    if (i < 0) return { matchedCount: 0 };
    const next = clone(doc);
    next._id = this.docs[i]._id;
    this._checkUnique(next, this.docs[i]);
    this.docs[i] = next;
    return { matchedCount: 1 };
  }
  async updateOne(filter, update, opts = {}) {
    let d = this.docs.find(x => matches(x, filter)), inserted = false;
    if (!d) {
      if (!opts.upsert) return { matchedCount: 0 };
      d = {};
      for (const [k, v] of Object.entries(filter)) if (typeof v !== 'object') setPath(d, k, v);
      inserted = true;
    }
    for (const [op, fields] of Object.entries(update)) {
      for (const [k, v] of Object.entries(fields)) {
        if (op === '$set') setPath(d, k, clone(v));
        else if (op === '$setOnInsert') { if (inserted) setPath(d, k, clone(v)); }
        else if (op === '$inc') setPath(d, k, (getPath(d, k) || 0) + v);
        else if (op === '$max') { const c = getPath(d, k); if (c === undefined || v > c) setPath(d, k, v); }
        else throw new Error('fake-mongo: unsupported update ' + op);
      }
    }
    if (inserted) { if (d._id === undefined) d._id = 'oid' + ++this.seq; this.docs.push(d); }
    return { matchedCount: inserted ? 0 : 1, upsertedCount: inserted ? 1 : 0 };
  }
  async deleteOne(filter) { const i = this.docs.findIndex(d => matches(d, filter)); if (i >= 0) this.docs.splice(i, 1); return { deletedCount: i >= 0 ? 1 : 0 }; }
  async deleteMany(filter) { const before = this.docs.length; this.docs = this.docs.filter(d => !matches(d, filter)); return { deletedCount: before - this.docs.length }; }
}

const fakeDb = () => Object.fromEntries(['accounts', 'companies', 'events', 'stats', 'media', 'settings', 'users', 'qrcodes', 'scans', 'qrfiles'].map(n => [n, new Collection()]));

module.exports = { fakeDb, Collection };
