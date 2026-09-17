import { app as R, ipcMain as X, nativeTheme as ot, globalShortcut as _e, BrowserWindow as rt, nativeImage as We, Tray as Lt, Menu as Ut, shell as he } from "electron";
import { exec as oe } from "child_process";
import { promisify as Nt } from "node:util";
import { fileURLToPath as Ht } from "node:url";
import W from "node:path";
import ge from "node:fs";
var Ce;
function a(e, t, n) {
  function o(c, u) {
    if (c._zod || Object.defineProperty(c, "_zod", {
      value: {
        def: u,
        constr: i,
        traits: /* @__PURE__ */ new Set()
      },
      enumerable: !1
    }), c._zod.traits.has(e))
      return;
    c._zod.traits.add(e), t(c, u);
    const l = i.prototype, f = Object.keys(l);
    for (let d = 0; d < f.length; d++) {
      const h = f[d];
      h in c || (c[h] = l[h].bind(c));
    }
  }
  const r = (n == null ? void 0 : n.Parent) ?? Object;
  class s extends r {
  }
  Object.defineProperty(s, "name", { value: e });
  function i(c) {
    var u;
    const l = n != null && n.Parent ? new s() : this;
    o(l, c), (u = l._zod).deferred ?? (u.deferred = []);
    for (const f of l._zod.deferred)
      f();
    return l;
  }
  return Object.defineProperty(i, "init", { value: o }), Object.defineProperty(i, Symbol.hasInstance, {
    value: (c) => {
      var u, l;
      return n != null && n.Parent && c instanceof n.Parent ? !0 : (l = (u = c == null ? void 0 : c._zod) == null ? void 0 : u.traits) == null ? void 0 : l.has(e);
    }
  }), Object.defineProperty(i, "name", { value: e }), i;
}
class x extends Error {
  constructor() {
    super("Encountered Promise during synchronous parse. Use .parseAsync() instead.");
  }
}
class st extends Error {
  constructor(t) {
    super(`Encountered unidirectional transform during encode: ${t}`), this.name = "ZodEncodeError";
  }
}
(Ce = globalThis).__zod_globalConfig ?? (Ce.__zod_globalConfig = {});
const ze = globalThis.__zod_globalConfig;
function U(e) {
  return ze;
}
function it(e) {
  const t = Object.values(e).filter((o) => typeof o == "number");
  return Object.entries(e).filter(([o, r]) => t.indexOf(+o) === -1).map(([o, r]) => r);
}
function we(e, t) {
  return typeof t == "bigint" ? t.toString() : t;
}
function be(e) {
  return {
    get value() {
      {
        const t = e();
        return Object.defineProperty(this, "value", { value: t }), t;
      }
    }
  };
}
function ke(e) {
  return e == null;
}
function Ze(e) {
  const t = e.startsWith("^") ? 1 : 0, n = e.endsWith("$") ? e.length - 1 : e.length;
  return e.slice(t, n);
}
const Re = /* @__PURE__ */ Symbol("evaluating");
function g(e, t, n) {
  let o;
  Object.defineProperty(e, t, {
    get() {
      if (o !== Re)
        return o === void 0 && (o = Re, o = n()), o;
    },
    set(r) {
      Object.defineProperty(e, t, {
        value: r
        // configurable: true,
      });
    },
    configurable: !0
  });
}
function H(e, t, n) {
  Object.defineProperty(e, t, {
    value: n,
    writable: !0,
    enumerable: !0,
    configurable: !0
  });
}
function D(...e) {
  const t = {};
  for (const n of e) {
    const o = Object.getOwnPropertyDescriptors(n);
    Object.assign(t, o);
  }
  return Object.defineProperties({}, t);
}
function De(e) {
  return JSON.stringify(e);
}
function Mt(e) {
  return e.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
}
const ct = "captureStackTrace" in Error ? Error.captureStackTrace : (...e) => {
};
function re(e) {
  return typeof e == "object" && e !== null && !Array.isArray(e);
}
const Ft = /* @__PURE__ */ be(() => {
  var e;
  if (ze.jitless || typeof navigator < "u" && ((e = navigator == null ? void 0 : navigator.userAgent) != null && e.includes("Cloudflare")))
    return !1;
  try {
    const t = Function;
    return new t(""), !0;
  } catch {
    return !1;
  }
});
function q(e) {
  if (re(e) === !1)
    return !1;
  const t = e.constructor;
  if (t === void 0 || typeof t != "function")
    return !0;
  const n = t.prototype;
  return !(re(n) === !1 || Object.prototype.hasOwnProperty.call(n, "isPrototypeOf") === !1);
}
function at(e) {
  return q(e) ? { ...e } : Array.isArray(e) ? [...e] : e instanceof Map ? new Map(e) : e instanceof Set ? new Set(e) : e;
}
const xt = /* @__PURE__ */ new Set(["string", "number", "symbol"]);
function ue(e) {
  return e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function L(e, t, n) {
  const o = new e._zod.constr(t ?? e._zod.def);
  return (!t || n != null && n.parent) && (o._zod.parent = e), o;
}
function m(e) {
  const t = e;
  if (!t)
    return {};
  if (typeof t == "string")
    return { error: () => t };
  if ((t == null ? void 0 : t.message) !== void 0) {
    if ((t == null ? void 0 : t.error) !== void 0)
      throw new Error("Cannot specify both `message` and `error` params");
    t.error = t.message;
  }
  return delete t.message, typeof t.error == "string" ? { ...t, error: () => t.error } : t;
}
function Jt(e) {
  return Object.keys(e).filter((t) => e[t]._zod.optin === "optional" && e[t]._zod.optout === "optional");
}
function Vt(e, t) {
  const n = e._zod.def, o = n.checks;
  if (o && o.length > 0)
    throw new Error(".pick() cannot be used on object schemas containing refinements");
  const s = D(e._zod.def, {
    get shape() {
      const i = {};
      for (const c in t) {
        if (!(c in n.shape))
          throw new Error(`Unrecognized key: "${c}"`);
        t[c] && (i[c] = n.shape[c]);
      }
      return H(this, "shape", i), i;
    },
    checks: []
  });
  return L(e, s);
}
function Bt(e, t) {
  const n = e._zod.def, o = n.checks;
  if (o && o.length > 0)
    throw new Error(".omit() cannot be used on object schemas containing refinements");
  const s = D(e._zod.def, {
    get shape() {
      const i = { ...e._zod.def.shape };
      for (const c in t) {
        if (!(c in n.shape))
          throw new Error(`Unrecognized key: "${c}"`);
        t[c] && delete i[c];
      }
      return H(this, "shape", i), i;
    },
    checks: []
  });
  return L(e, s);
}
function Kt(e, t) {
  if (!q(t))
    throw new Error("Invalid input to extend: expected a plain object");
  const n = e._zod.def.checks;
  if (n && n.length > 0) {
    const s = e._zod.def.shape;
    for (const i in t)
      if (Object.getOwnPropertyDescriptor(s, i) !== void 0)
        throw new Error("Cannot overwrite keys on object schemas containing refinements. Use `.safeExtend()` instead.");
  }
  const r = D(e._zod.def, {
    get shape() {
      const s = { ...e._zod.def.shape, ...t };
      return H(this, "shape", s), s;
    }
  });
  return L(e, r);
}
function qt(e, t) {
  if (!q(t))
    throw new Error("Invalid input to safeExtend: expected a plain object");
  const n = D(e._zod.def, {
    get shape() {
      const o = { ...e._zod.def.shape, ...t };
      return H(this, "shape", o), o;
    }
  });
  return L(e, n);
}
function Gt(e, t) {
  var o;
  if ((o = e._zod.def.checks) != null && o.length)
    throw new Error(".merge() cannot be used on object schemas containing refinements. Use .safeExtend() instead.");
  const n = D(e._zod.def, {
    get shape() {
      const r = { ...e._zod.def.shape, ...t._zod.def.shape };
      return H(this, "shape", r), r;
    },
    get catchall() {
      return t._zod.def.catchall;
    },
    checks: t._zod.def.checks ?? []
  });
  return L(e, n);
}
function Xt(e, t, n) {
  const r = t._zod.def.checks;
  if (r && r.length > 0)
    throw new Error(".partial() cannot be used on object schemas containing refinements");
  const i = D(t._zod.def, {
    get shape() {
      const c = t._zod.def.shape, u = { ...c };
      if (n)
        for (const l in n) {
          if (!(l in c))
            throw new Error(`Unrecognized key: "${l}"`);
          n[l] && (u[l] = e ? new e({
            type: "optional",
            innerType: c[l]
          }) : c[l]);
        }
      else
        for (const l in c)
          u[l] = e ? new e({
            type: "optional",
            innerType: c[l]
          }) : c[l];
      return H(this, "shape", u), u;
    },
    checks: []
  });
  return L(t, i);
}
function Yt(e, t, n) {
  const o = D(t._zod.def, {
    get shape() {
      const r = t._zod.def.shape, s = { ...r };
      if (n)
        for (const i in n) {
          if (!(i in s))
            throw new Error(`Unrecognized key: "${i}"`);
          n[i] && (s[i] = new e({
            type: "nonoptional",
            innerType: r[i]
          }));
        }
      else
        for (const i in r)
          s[i] = new e({
            type: "nonoptional",
            innerType: r[i]
          });
      return H(this, "shape", s), s;
    }
  });
  return L(t, o);
}
function F(e, t = 0) {
  var n;
  if (e.aborted === !0)
    return !0;
  for (let o = t; o < e.issues.length; o++)
    if (((n = e.issues[o]) == null ? void 0 : n.continue) !== !0)
      return !0;
  return !1;
}
function Qt(e, t = 0) {
  var n;
  if (e.aborted === !0)
    return !0;
  for (let o = t; o < e.issues.length; o++)
    if (((n = e.issues[o]) == null ? void 0 : n.continue) === !1)
      return !0;
  return !1;
}
function ut(e, t) {
  return t.map((n) => {
    var o;
    return (o = n).path ?? (o.path = []), n.path.unshift(e), n;
  });
}
function Y(e) {
  return typeof e == "string" ? e : e == null ? void 0 : e.message;
}
function N(e, t, n) {
  var u, l, f, d, h, p;
  const o = e.message ? e.message : Y((f = (l = (u = e.inst) == null ? void 0 : u._zod.def) == null ? void 0 : l.error) == null ? void 0 : f.call(l, e)) ?? Y((d = t == null ? void 0 : t.error) == null ? void 0 : d.call(t, e)) ?? Y((h = n.customError) == null ? void 0 : h.call(n, e)) ?? Y((p = n.localeError) == null ? void 0 : p.call(n, e)) ?? "Invalid input", { inst: r, continue: s, input: i, ...c } = e;
  return c.path ?? (c.path = []), c.message = o, t != null && t.reportInput && (c.input = i), c;
}
function Se(e) {
  return Array.isArray(e) ? "array" : typeof e == "string" ? "string" : "unknown";
}
function G(...e) {
  const [t, n, o] = e;
  return typeof t == "string" ? {
    message: t,
    code: "custom",
    input: n,
    inst: o
  } : { ...t };
}
const ft = (e, t) => {
  e.name = "$ZodError", Object.defineProperty(e, "_zod", {
    value: e._zod,
    enumerable: !1
  }), Object.defineProperty(e, "issues", {
    value: t,
    enumerable: !1
  }), e.message = JSON.stringify(t, we, 2), Object.defineProperty(e, "toString", {
    value: () => e.message,
    enumerable: !1
  });
}, lt = a("$ZodError", ft), dt = a("$ZodError", ft, { Parent: Error });
function en(e, t = (n) => n.message) {
  const n = {}, o = [];
  for (const r of e.issues)
    r.path.length > 0 ? (n[r.path[0]] = n[r.path[0]] || [], n[r.path[0]].push(t(r))) : o.push(t(r));
  return { formErrors: o, fieldErrors: n };
}
function tn(e, t = (n) => n.message) {
  const n = { _errors: [] }, o = (r, s = []) => {
    for (const i of r.issues)
      if (i.code === "invalid_union" && i.errors.length)
        i.errors.map((c) => o({ issues: c }, [...s, ...i.path]));
      else if (i.code === "invalid_key")
        o({ issues: i.issues }, [...s, ...i.path]);
      else if (i.code === "invalid_element")
        o({ issues: i.issues }, [...s, ...i.path]);
      else {
        const c = [...s, ...i.path];
        if (c.length === 0)
          n._errors.push(t(i));
        else {
          let u = n, l = 0;
          for (; l < c.length; ) {
            const f = c[l];
            l === c.length - 1 ? (u[f] = u[f] || { _errors: [] }, u[f]._errors.push(t(i))) : u[f] = u[f] || { _errors: [] }, u = u[f], l++;
          }
        }
      }
  };
  return o(e), n;
}
const Ae = (e) => (t, n, o, r) => {
  const s = o ? { ...o, async: !1 } : { async: !1 }, i = t._zod.run({ value: n, issues: [] }, s);
  if (i instanceof Promise)
    throw new x();
  if (i.issues.length) {
    const c = new ((r == null ? void 0 : r.Err) ?? e)(i.issues.map((u) => N(u, s, U())));
    throw ct(c, r == null ? void 0 : r.callee), c;
  }
  return i.value;
}, Oe = (e) => async (t, n, o, r) => {
  const s = o ? { ...o, async: !0 } : { async: !0 };
  let i = t._zod.run({ value: n, issues: [] }, s);
  if (i instanceof Promise && (i = await i), i.issues.length) {
    const c = new ((r == null ? void 0 : r.Err) ?? e)(i.issues.map((u) => N(u, s, U())));
    throw ct(c, r == null ? void 0 : r.callee), c;
  }
  return i.value;
}, fe = (e) => (t, n, o) => {
  const r = o ? { ...o, async: !1 } : { async: !1 }, s = t._zod.run({ value: n, issues: [] }, r);
  if (s instanceof Promise)
    throw new x();
  return s.issues.length ? {
    success: !1,
    error: new (e ?? lt)(s.issues.map((i) => N(i, r, U())))
  } : { success: !0, data: s.value };
}, nn = /* @__PURE__ */ fe(dt), le = (e) => async (t, n, o) => {
  const r = o ? { ...o, async: !0 } : { async: !0 };
  let s = t._zod.run({ value: n, issues: [] }, r);
  return s instanceof Promise && (s = await s), s.issues.length ? {
    success: !1,
    error: new e(s.issues.map((i) => N(i, r, U())))
  } : { success: !0, data: s.value };
}, on = /* @__PURE__ */ le(dt), rn = (e) => (t, n, o) => {
  const r = o ? { ...o, direction: "backward" } : { direction: "backward" };
  return Ae(e)(t, n, r);
}, sn = (e) => (t, n, o) => Ae(e)(t, n, o), cn = (e) => async (t, n, o) => {
  const r = o ? { ...o, direction: "backward" } : { direction: "backward" };
  return Oe(e)(t, n, r);
}, an = (e) => async (t, n, o) => Oe(e)(t, n, o), un = (e) => (t, n, o) => {
  const r = o ? { ...o, direction: "backward" } : { direction: "backward" };
  return fe(e)(t, n, r);
}, fn = (e) => (t, n, o) => fe(e)(t, n, o), ln = (e) => async (t, n, o) => {
  const r = o ? { ...o, direction: "backward" } : { direction: "backward" };
  return le(e)(t, n, r);
}, dn = (e) => async (t, n, o) => le(e)(t, n, o), pn = /^[cC][0-9a-z]{6,}$/, hn = /^[0-9a-z]+$/, mn = /^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$/, _n = /^[0-9a-vA-V]{20}$/, gn = /^[A-Za-z0-9]{27}$/, wn = /^[a-zA-Z0-9_-]{21}$/, $n = /^P(?:(\d+W)|(?!.*W)(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+([.,]\d+)?S)?)?)$/, yn = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/, Le = (e) => e ? new RegExp(`^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${e}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`) : /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/, vn = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/, zn = "^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$";
function bn() {
  return new RegExp(zn, "u");
}
const kn = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/, Zn = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/, Sn = /^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/([0-9]|[1-2][0-9]|3[0-2])$/, An = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::|([0-9a-fA-F]{1,4})?::([0-9a-fA-F]{1,4}:?){0,6})\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/, On = /^$|^(?:[0-9a-zA-Z+/]{4})*(?:(?:[0-9a-zA-Z+/]{2}==)|(?:[0-9a-zA-Z+/]{3}=))?$/, pt = /^[A-Za-z0-9_-]*$/, En = /^https?$/, Tn = /^\+[1-9]\d{6,14}$/, ht = "(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))", Pn = /* @__PURE__ */ new RegExp(`^${ht}$`);
function mt(e) {
  const t = "(?:[01]\\d|2[0-3]):[0-5]\\d";
  return typeof e.precision == "number" ? e.precision === -1 ? `${t}` : e.precision === 0 ? `${t}:[0-5]\\d` : `${t}:[0-5]\\d\\.\\d{${e.precision}}` : `${t}(?::[0-5]\\d(?:\\.\\d+)?)?`;
}
function In(e) {
  return new RegExp(`^${mt(e)}$`);
}
function jn(e) {
  const t = mt({ precision: e.precision }), n = ["Z"];
  e.local && n.push(""), e.offset && n.push("([+-](?:[01]\\d|2[0-3]):[0-5]\\d)");
  const o = `${t}(?:${n.join("|")})`;
  return new RegExp(`^${ht}T(?:${o})$`);
}
const Wn = (e) => {
  const t = e ? `[\\s\\S]{${(e == null ? void 0 : e.minimum) ?? 0},${(e == null ? void 0 : e.maximum) ?? ""}}` : "[\\s\\S]*";
  return new RegExp(`^${t}$`);
}, Cn = /^[^A-Z]*$/, Rn = /^[^a-z]*$/, C = /* @__PURE__ */ a("$ZodCheck", (e, t) => {
  var n;
  e._zod ?? (e._zod = {}), e._zod.def = t, (n = e._zod).onattach ?? (n.onattach = []);
}), Dn = /* @__PURE__ */ a("$ZodCheckMaxLength", (e, t) => {
  var n;
  C.init(e, t), (n = e._zod.def).when ?? (n.when = (o) => {
    const r = o.value;
    return !ke(r) && r.length !== void 0;
  }), e._zod.onattach.push((o) => {
    const r = o._zod.bag.maximum ?? Number.POSITIVE_INFINITY;
    t.maximum < r && (o._zod.bag.maximum = t.maximum);
  }), e._zod.check = (o) => {
    const r = o.value;
    if (r.length <= t.maximum)
      return;
    const i = Se(r);
    o.issues.push({
      origin: i,
      code: "too_big",
      maximum: t.maximum,
      inclusive: !0,
      input: r,
      inst: e,
      continue: !t.abort
    });
  };
}), Ln = /* @__PURE__ */ a("$ZodCheckMinLength", (e, t) => {
  var n;
  C.init(e, t), (n = e._zod.def).when ?? (n.when = (o) => {
    const r = o.value;
    return !ke(r) && r.length !== void 0;
  }), e._zod.onattach.push((o) => {
    const r = o._zod.bag.minimum ?? Number.NEGATIVE_INFINITY;
    t.minimum > r && (o._zod.bag.minimum = t.minimum);
  }), e._zod.check = (o) => {
    const r = o.value;
    if (r.length >= t.minimum)
      return;
    const i = Se(r);
    o.issues.push({
      origin: i,
      code: "too_small",
      minimum: t.minimum,
      inclusive: !0,
      input: r,
      inst: e,
      continue: !t.abort
    });
  };
}), Un = /* @__PURE__ */ a("$ZodCheckLengthEquals", (e, t) => {
  var n;
  C.init(e, t), (n = e._zod.def).when ?? (n.when = (o) => {
    const r = o.value;
    return !ke(r) && r.length !== void 0;
  }), e._zod.onattach.push((o) => {
    const r = o._zod.bag;
    r.minimum = t.length, r.maximum = t.length, r.length = t.length;
  }), e._zod.check = (o) => {
    const r = o.value, s = r.length;
    if (s === t.length)
      return;
    const i = Se(r), c = s > t.length;
    o.issues.push({
      origin: i,
      ...c ? { code: "too_big", maximum: t.length } : { code: "too_small", minimum: t.length },
      inclusive: !0,
      exact: !0,
      input: o.value,
      inst: e,
      continue: !t.abort
    });
  };
}), de = /* @__PURE__ */ a("$ZodCheckStringFormat", (e, t) => {
  var n, o;
  C.init(e, t), e._zod.onattach.push((r) => {
    const s = r._zod.bag;
    s.format = t.format, t.pattern && (s.patterns ?? (s.patterns = /* @__PURE__ */ new Set()), s.patterns.add(t.pattern));
  }), t.pattern ? (n = e._zod).check ?? (n.check = (r) => {
    t.pattern.lastIndex = 0, !t.pattern.test(r.value) && r.issues.push({
      origin: "string",
      code: "invalid_format",
      format: t.format,
      input: r.value,
      ...t.pattern ? { pattern: t.pattern.toString() } : {},
      inst: e,
      continue: !t.abort
    });
  }) : (o = e._zod).check ?? (o.check = () => {
  });
}), Nn = /* @__PURE__ */ a("$ZodCheckRegex", (e, t) => {
  de.init(e, t), e._zod.check = (n) => {
    t.pattern.lastIndex = 0, !t.pattern.test(n.value) && n.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "regex",
      input: n.value,
      pattern: t.pattern.toString(),
      inst: e,
      continue: !t.abort
    });
  };
}), Hn = /* @__PURE__ */ a("$ZodCheckLowerCase", (e, t) => {
  t.pattern ?? (t.pattern = Cn), de.init(e, t);
}), Mn = /* @__PURE__ */ a("$ZodCheckUpperCase", (e, t) => {
  t.pattern ?? (t.pattern = Rn), de.init(e, t);
}), Fn = /* @__PURE__ */ a("$ZodCheckIncludes", (e, t) => {
  C.init(e, t);
  const n = ue(t.includes), o = new RegExp(typeof t.position == "number" ? `^.{${t.position}}${n}` : n);
  t.pattern = o, e._zod.onattach.push((r) => {
    const s = r._zod.bag;
    s.patterns ?? (s.patterns = /* @__PURE__ */ new Set()), s.patterns.add(o);
  }), e._zod.check = (r) => {
    r.value.includes(t.includes, t.position) || r.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "includes",
      includes: t.includes,
      input: r.value,
      inst: e,
      continue: !t.abort
    });
  };
}), xn = /* @__PURE__ */ a("$ZodCheckStartsWith", (e, t) => {
  C.init(e, t);
  const n = new RegExp(`^${ue(t.prefix)}.*`);
  t.pattern ?? (t.pattern = n), e._zod.onattach.push((o) => {
    const r = o._zod.bag;
    r.patterns ?? (r.patterns = /* @__PURE__ */ new Set()), r.patterns.add(n);
  }), e._zod.check = (o) => {
    o.value.startsWith(t.prefix) || o.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "starts_with",
      prefix: t.prefix,
      input: o.value,
      inst: e,
      continue: !t.abort
    });
  };
}), Jn = /* @__PURE__ */ a("$ZodCheckEndsWith", (e, t) => {
  C.init(e, t);
  const n = new RegExp(`.*${ue(t.suffix)}$`);
  t.pattern ?? (t.pattern = n), e._zod.onattach.push((o) => {
    const r = o._zod.bag;
    r.patterns ?? (r.patterns = /* @__PURE__ */ new Set()), r.patterns.add(n);
  }), e._zod.check = (o) => {
    o.value.endsWith(t.suffix) || o.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "ends_with",
      suffix: t.suffix,
      input: o.value,
      inst: e,
      continue: !t.abort
    });
  };
}), Vn = /* @__PURE__ */ a("$ZodCheckOverwrite", (e, t) => {
  C.init(e, t), e._zod.check = (n) => {
    n.value = t.tx(n.value);
  };
});
class Bn {
  constructor(t = []) {
    this.content = [], this.indent = 0, this && (this.args = t);
  }
  indented(t) {
    this.indent += 1, t(this), this.indent -= 1;
  }
  write(t) {
    if (typeof t == "function") {
      t(this, { execution: "sync" }), t(this, { execution: "async" });
      return;
    }
    const o = t.split(`
`).filter((i) => i), r = Math.min(...o.map((i) => i.length - i.trimStart().length)), s = o.map((i) => i.slice(r)).map((i) => " ".repeat(this.indent * 2) + i);
    for (const i of s)
      this.content.push(i);
  }
  compile() {
    const t = Function, n = this == null ? void 0 : this.args, r = [...((this == null ? void 0 : this.content) ?? [""]).map((s) => `  ${s}`)];
    return new t(...n, r.join(`
`));
  }
}
const Kn = {
  major: 4,
  minor: 4,
  patch: 3
}, k = /* @__PURE__ */ a("$ZodType", (e, t) => {
  var r;
  var n;
  e ?? (e = {}), e._zod.def = t, e._zod.bag = e._zod.bag || {}, e._zod.version = Kn;
  const o = [...e._zod.def.checks ?? []];
  e._zod.traits.has("$ZodCheck") && o.unshift(e);
  for (const s of o)
    for (const i of s._zod.onattach)
      i(e);
  if (o.length === 0)
    (n = e._zod).deferred ?? (n.deferred = []), (r = e._zod.deferred) == null || r.push(() => {
      e._zod.run = e._zod.parse;
    });
  else {
    const s = (c, u, l) => {
      let f = F(c), d;
      for (const h of u) {
        if (h._zod.def.when) {
          if (Qt(c) || !h._zod.def.when(c))
            continue;
        } else if (f)
          continue;
        const p = c.issues.length, w = h._zod.check(c);
        if (w instanceof Promise && (l == null ? void 0 : l.async) === !1)
          throw new x();
        if (d || w instanceof Promise)
          d = (d ?? Promise.resolve()).then(async () => {
            await w, c.issues.length !== p && (f || (f = F(c, p)));
          });
        else {
          if (c.issues.length === p)
            continue;
          f || (f = F(c, p));
        }
      }
      return d ? d.then(() => c) : c;
    }, i = (c, u, l) => {
      if (F(c))
        return c.aborted = !0, c;
      const f = s(u, o, l);
      if (f instanceof Promise) {
        if (l.async === !1)
          throw new x();
        return f.then((d) => e._zod.parse(d, l));
      }
      return e._zod.parse(f, l);
    };
    e._zod.run = (c, u) => {
      if (u.skipChecks)
        return e._zod.parse(c, u);
      if (u.direction === "backward") {
        const f = e._zod.parse({ value: c.value, issues: [] }, { ...u, skipChecks: !0 });
        return f instanceof Promise ? f.then((d) => i(d, c, u)) : i(f, c, u);
      }
      const l = e._zod.parse(c, u);
      if (l instanceof Promise) {
        if (u.async === !1)
          throw new x();
        return l.then((f) => s(f, o, u));
      }
      return s(l, o, u);
    };
  }
  g(e, "~standard", () => ({
    validate: (s) => {
      var i;
      try {
        const c = nn(e, s);
        return c.success ? { value: c.data } : { issues: (i = c.error) == null ? void 0 : i.issues };
      } catch {
        return on(e, s).then((u) => {
          var l;
          return u.success ? { value: u.data } : { issues: (l = u.error) == null ? void 0 : l.issues };
        });
      }
    },
    vendor: "zod",
    version: 1
  }));
}), Ee = /* @__PURE__ */ a("$ZodString", (e, t) => {
  var n;
  k.init(e, t), e._zod.pattern = [...((n = e == null ? void 0 : e._zod.bag) == null ? void 0 : n.patterns) ?? []].pop() ?? Wn(e._zod.bag), e._zod.parse = (o, r) => {
    if (t.coerce)
      try {
        o.value = String(o.value);
      } catch {
      }
    return typeof o.value == "string" || o.issues.push({
      expected: "string",
      code: "invalid_type",
      input: o.value,
      inst: e
    }), o;
  };
}), $ = /* @__PURE__ */ a("$ZodStringFormat", (e, t) => {
  de.init(e, t), Ee.init(e, t);
}), qn = /* @__PURE__ */ a("$ZodGUID", (e, t) => {
  t.pattern ?? (t.pattern = yn), $.init(e, t);
}), Gn = /* @__PURE__ */ a("$ZodUUID", (e, t) => {
  if (t.version) {
    const o = {
      v1: 1,
      v2: 2,
      v3: 3,
      v4: 4,
      v5: 5,
      v6: 6,
      v7: 7,
      v8: 8
    }[t.version];
    if (o === void 0)
      throw new Error(`Invalid UUID version: "${t.version}"`);
    t.pattern ?? (t.pattern = Le(o));
  } else
    t.pattern ?? (t.pattern = Le());
  $.init(e, t);
}), Xn = /* @__PURE__ */ a("$ZodEmail", (e, t) => {
  t.pattern ?? (t.pattern = vn), $.init(e, t);
}), Yn = /* @__PURE__ */ a("$ZodURL", (e, t) => {
  $.init(e, t), e._zod.check = (n) => {
    var o;
    try {
      const r = n.value.trim();
      if (!t.normalize && ((o = t.protocol) == null ? void 0 : o.source) === En.source && !/^https?:\/\//i.test(r)) {
        n.issues.push({
          code: "invalid_format",
          format: "url",
          note: "Invalid URL format",
          input: n.value,
          inst: e,
          continue: !t.abort
        });
        return;
      }
      const s = new URL(r);
      t.hostname && (t.hostname.lastIndex = 0, t.hostname.test(s.hostname) || n.issues.push({
        code: "invalid_format",
        format: "url",
        note: "Invalid hostname",
        pattern: t.hostname.source,
        input: n.value,
        inst: e,
        continue: !t.abort
      })), t.protocol && (t.protocol.lastIndex = 0, t.protocol.test(s.protocol.endsWith(":") ? s.protocol.slice(0, -1) : s.protocol) || n.issues.push({
        code: "invalid_format",
        format: "url",
        note: "Invalid protocol",
        pattern: t.protocol.source,
        input: n.value,
        inst: e,
        continue: !t.abort
      })), t.normalize ? n.value = s.href : n.value = r;
      return;
    } catch {
      n.issues.push({
        code: "invalid_format",
        format: "url",
        input: n.value,
        inst: e,
        continue: !t.abort
      });
    }
  };
}), Qn = /* @__PURE__ */ a("$ZodEmoji", (e, t) => {
  t.pattern ?? (t.pattern = bn()), $.init(e, t);
}), eo = /* @__PURE__ */ a("$ZodNanoID", (e, t) => {
  t.pattern ?? (t.pattern = wn), $.init(e, t);
}), to = /* @__PURE__ */ a("$ZodCUID", (e, t) => {
  t.pattern ?? (t.pattern = pn), $.init(e, t);
}), no = /* @__PURE__ */ a("$ZodCUID2", (e, t) => {
  t.pattern ?? (t.pattern = hn), $.init(e, t);
}), oo = /* @__PURE__ */ a("$ZodULID", (e, t) => {
  t.pattern ?? (t.pattern = mn), $.init(e, t);
}), ro = /* @__PURE__ */ a("$ZodXID", (e, t) => {
  t.pattern ?? (t.pattern = _n), $.init(e, t);
}), so = /* @__PURE__ */ a("$ZodKSUID", (e, t) => {
  t.pattern ?? (t.pattern = gn), $.init(e, t);
}), io = /* @__PURE__ */ a("$ZodISODateTime", (e, t) => {
  t.pattern ?? (t.pattern = jn(t)), $.init(e, t);
}), co = /* @__PURE__ */ a("$ZodISODate", (e, t) => {
  t.pattern ?? (t.pattern = Pn), $.init(e, t);
}), ao = /* @__PURE__ */ a("$ZodISOTime", (e, t) => {
  t.pattern ?? (t.pattern = In(t)), $.init(e, t);
}), uo = /* @__PURE__ */ a("$ZodISODuration", (e, t) => {
  t.pattern ?? (t.pattern = $n), $.init(e, t);
}), fo = /* @__PURE__ */ a("$ZodIPv4", (e, t) => {
  t.pattern ?? (t.pattern = kn), $.init(e, t), e._zod.bag.format = "ipv4";
}), lo = /* @__PURE__ */ a("$ZodIPv6", (e, t) => {
  t.pattern ?? (t.pattern = Zn), $.init(e, t), e._zod.bag.format = "ipv6", e._zod.check = (n) => {
    try {
      new URL(`http://[${n.value}]`);
    } catch {
      n.issues.push({
        code: "invalid_format",
        format: "ipv6",
        input: n.value,
        inst: e,
        continue: !t.abort
      });
    }
  };
}), po = /* @__PURE__ */ a("$ZodCIDRv4", (e, t) => {
  t.pattern ?? (t.pattern = Sn), $.init(e, t);
}), ho = /* @__PURE__ */ a("$ZodCIDRv6", (e, t) => {
  t.pattern ?? (t.pattern = An), $.init(e, t), e._zod.check = (n) => {
    const o = n.value.split("/");
    try {
      if (o.length !== 2)
        throw new Error();
      const [r, s] = o;
      if (!s)
        throw new Error();
      const i = Number(s);
      if (`${i}` !== s)
        throw new Error();
      if (i < 0 || i > 128)
        throw new Error();
      new URL(`http://[${r}]`);
    } catch {
      n.issues.push({
        code: "invalid_format",
        format: "cidrv6",
        input: n.value,
        inst: e,
        continue: !t.abort
      });
    }
  };
});
function _t(e) {
  if (e === "")
    return !0;
  if (/\s/.test(e) || e.length % 4 !== 0)
    return !1;
  try {
    return atob(e), !0;
  } catch {
    return !1;
  }
}
const mo = /* @__PURE__ */ a("$ZodBase64", (e, t) => {
  t.pattern ?? (t.pattern = On), $.init(e, t), e._zod.bag.contentEncoding = "base64", e._zod.check = (n) => {
    _t(n.value) || n.issues.push({
      code: "invalid_format",
      format: "base64",
      input: n.value,
      inst: e,
      continue: !t.abort
    });
  };
});
function _o(e) {
  if (!pt.test(e))
    return !1;
  const t = e.replace(/[-_]/g, (o) => o === "-" ? "+" : "/"), n = t.padEnd(Math.ceil(t.length / 4) * 4, "=");
  return _t(n);
}
const go = /* @__PURE__ */ a("$ZodBase64URL", (e, t) => {
  t.pattern ?? (t.pattern = pt), $.init(e, t), e._zod.bag.contentEncoding = "base64url", e._zod.check = (n) => {
    _o(n.value) || n.issues.push({
      code: "invalid_format",
      format: "base64url",
      input: n.value,
      inst: e,
      continue: !t.abort
    });
  };
}), wo = /* @__PURE__ */ a("$ZodE164", (e, t) => {
  t.pattern ?? (t.pattern = Tn), $.init(e, t);
});
function $o(e, t = null) {
  try {
    const n = e.split(".");
    if (n.length !== 3)
      return !1;
    const [o] = n;
    if (!o)
      return !1;
    const r = JSON.parse(atob(o));
    return !("typ" in r && (r == null ? void 0 : r.typ) !== "JWT" || !r.alg || t && (!("alg" in r) || r.alg !== t));
  } catch {
    return !1;
  }
}
const yo = /* @__PURE__ */ a("$ZodJWT", (e, t) => {
  $.init(e, t), e._zod.check = (n) => {
    $o(n.value, t.alg) || n.issues.push({
      code: "invalid_format",
      format: "jwt",
      input: n.value,
      inst: e,
      continue: !t.abort
    });
  };
}), vo = /* @__PURE__ */ a("$ZodUnknown", (e, t) => {
  k.init(e, t), e._zod.parse = (n) => n;
}), zo = /* @__PURE__ */ a("$ZodNever", (e, t) => {
  k.init(e, t), e._zod.parse = (n, o) => (n.issues.push({
    expected: "never",
    code: "invalid_type",
    input: n.value,
    inst: e
  }), n);
});
function Ue(e, t, n) {
  e.issues.length && t.issues.push(...ut(n, e.issues)), t.value[n] = e.value;
}
const bo = /* @__PURE__ */ a("$ZodArray", (e, t) => {
  k.init(e, t), e._zod.parse = (n, o) => {
    const r = n.value;
    if (!Array.isArray(r))
      return n.issues.push({
        expected: "array",
        code: "invalid_type",
        input: r,
        inst: e
      }), n;
    n.value = Array(r.length);
    const s = [];
    for (let i = 0; i < r.length; i++) {
      const c = r[i], u = t.element._zod.run({
        value: c,
        issues: []
      }, o);
      u instanceof Promise ? s.push(u.then((l) => Ue(l, n, i))) : Ue(u, n, i);
    }
    return s.length ? Promise.all(s).then(() => n) : n;
  };
});
function se(e, t, n, o, r, s) {
  const i = n in o;
  if (e.issues.length) {
    if (r && s && !i)
      return;
    t.issues.push(...ut(n, e.issues));
  }
  if (!i && !r) {
    e.issues.length || t.issues.push({
      code: "invalid_type",
      expected: "nonoptional",
      input: void 0,
      path: [n]
    });
    return;
  }
  e.value === void 0 ? i && (t.value[n] = void 0) : t.value[n] = e.value;
}
function gt(e) {
  var o, r, s, i;
  const t = Object.keys(e.shape);
  for (const c of t)
    if (!((i = (s = (r = (o = e.shape) == null ? void 0 : o[c]) == null ? void 0 : r._zod) == null ? void 0 : s.traits) != null && i.has("$ZodType")))
      throw new Error(`Invalid element at key "${c}": expected a Zod schema`);
  const n = Jt(e.shape);
  return {
    ...e,
    keys: t,
    keySet: new Set(t),
    numKeys: t.length,
    optionalKeys: new Set(n)
  };
}
function wt(e, t, n, o, r, s) {
  const i = [], c = r.keySet, u = r.catchall._zod, l = u.def.type, f = u.optin === "optional", d = u.optout === "optional";
  for (const h in t) {
    if (h === "__proto__" || c.has(h))
      continue;
    if (l === "never") {
      i.push(h);
      continue;
    }
    const p = u.run({ value: t[h], issues: [] }, o);
    p instanceof Promise ? e.push(p.then((w) => se(w, n, h, t, f, d))) : se(p, n, h, t, f, d);
  }
  return i.length && n.issues.push({
    code: "unrecognized_keys",
    keys: i,
    input: t,
    inst: s
  }), e.length ? Promise.all(e).then(() => n) : n;
}
const ko = /* @__PURE__ */ a("$ZodObject", (e, t) => {
  k.init(e, t);
  const n = Object.getOwnPropertyDescriptor(t, "shape");
  if (!(n != null && n.get)) {
    const c = t.shape;
    Object.defineProperty(t, "shape", {
      get: () => {
        const u = { ...c };
        return Object.defineProperty(t, "shape", {
          value: u
        }), u;
      }
    });
  }
  const o = be(() => gt(t));
  g(e._zod, "propValues", () => {
    const c = t.shape, u = {};
    for (const l in c) {
      const f = c[l]._zod;
      if (f.values) {
        u[l] ?? (u[l] = /* @__PURE__ */ new Set());
        for (const d of f.values)
          u[l].add(d);
      }
    }
    return u;
  });
  const r = re, s = t.catchall;
  let i;
  e._zod.parse = (c, u) => {
    i ?? (i = o.value);
    const l = c.value;
    if (!r(l))
      return c.issues.push({
        expected: "object",
        code: "invalid_type",
        input: l,
        inst: e
      }), c;
    c.value = {};
    const f = [], d = i.shape;
    for (const h of i.keys) {
      const p = d[h], w = p._zod.optin === "optional", z = p._zod.optout === "optional", T = p._zod.run({ value: l[h], issues: [] }, u);
      T instanceof Promise ? f.push(T.then((b) => se(b, c, h, l, w, z))) : se(T, c, h, l, w, z);
    }
    return s ? wt(f, l, c, u, o.value, e) : f.length ? Promise.all(f).then(() => c) : c;
  };
}), Zo = /* @__PURE__ */ a("$ZodObjectJIT", (e, t) => {
  ko.init(e, t);
  const n = e._zod.parse, o = be(() => gt(t)), r = (h) => {
    var B, P;
    const p = new Bn(["shape", "payload", "ctx"]), w = o.value, z = (j) => {
      const v = De(j);
      return `shape[${v}]._zod.run({ value: input[${v}], issues: [] }, ctx)`;
    };
    p.write("const input = payload.value;");
    const T = /* @__PURE__ */ Object.create(null);
    let b = 0;
    for (const j of w.keys)
      T[j] = `key_${b++}`;
    p.write("const newResult = {};");
    for (const j of w.keys) {
      const v = T[j], A = De(j), M = h[j], je = ((B = M == null ? void 0 : M._zod) == null ? void 0 : B.optin) === "optional", Dt = ((P = M == null ? void 0 : M._zod) == null ? void 0 : P.optout) === "optional";
      p.write(`const ${v} = ${z(j)};`), je && Dt ? p.write(`
        if (${v}.issues.length) {
          if (${A} in input) {
            payload.issues = payload.issues.concat(${v}.issues.map(iss => ({
              ...iss,
              path: iss.path ? [${A}, ...iss.path] : [${A}]
            })));
          }
        }
        
        if (${v}.value === undefined) {
          if (${A} in input) {
            newResult[${A}] = undefined;
          }
        } else {
          newResult[${A}] = ${v}.value;
        }
        
      `) : je ? p.write(`
        if (${v}.issues.length) {
          payload.issues = payload.issues.concat(${v}.issues.map(iss => ({
            ...iss,
            path: iss.path ? [${A}, ...iss.path] : [${A}]
          })));
        }
        
        if (${v}.value === undefined) {
          if (${A} in input) {
            newResult[${A}] = undefined;
          }
        } else {
          newResult[${A}] = ${v}.value;
        }
        
      `) : p.write(`
        const ${v}_present = ${A} in input;
        if (${v}.issues.length) {
          payload.issues = payload.issues.concat(${v}.issues.map(iss => ({
            ...iss,
            path: iss.path ? [${A}, ...iss.path] : [${A}]
          })));
        }
        if (!${v}_present && !${v}.issues.length) {
          payload.issues.push({
            code: "invalid_type",
            expected: "nonoptional",
            input: undefined,
            path: [${A}]
          });
        }

        if (${v}_present) {
          if (${v}.value === undefined) {
            newResult[${A}] = undefined;
          } else {
            newResult[${A}] = ${v}.value;
          }
        }

      `);
    }
    p.write("payload.value = newResult;"), p.write("return payload;");
    const S = p.compile();
    return (j, v) => S(h, j, v);
  };
  let s;
  const i = re, c = !ze.jitless, l = c && Ft.value, f = t.catchall;
  let d;
  e._zod.parse = (h, p) => {
    d ?? (d = o.value);
    const w = h.value;
    return i(w) ? c && l && (p == null ? void 0 : p.async) === !1 && p.jitless !== !0 ? (s || (s = r(t.shape)), h = s(h, p), f ? wt([], w, h, p, d, e) : h) : n(h, p) : (h.issues.push({
      expected: "object",
      code: "invalid_type",
      input: w,
      inst: e
    }), h);
  };
});
function Ne(e, t, n, o) {
  for (const s of e)
    if (s.issues.length === 0)
      return t.value = s.value, t;
  const r = e.filter((s) => !F(s));
  return r.length === 1 ? (t.value = r[0].value, r[0]) : (t.issues.push({
    code: "invalid_union",
    input: t.value,
    inst: n,
    errors: e.map((s) => s.issues.map((i) => N(i, o, U())))
  }), t);
}
const So = /* @__PURE__ */ a("$ZodUnion", (e, t) => {
  k.init(e, t), g(e._zod, "optin", () => t.options.some((o) => o._zod.optin === "optional") ? "optional" : void 0), g(e._zod, "optout", () => t.options.some((o) => o._zod.optout === "optional") ? "optional" : void 0), g(e._zod, "values", () => {
    if (t.options.every((o) => o._zod.values))
      return new Set(t.options.flatMap((o) => Array.from(o._zod.values)));
  }), g(e._zod, "pattern", () => {
    if (t.options.every((o) => o._zod.pattern)) {
      const o = t.options.map((r) => r._zod.pattern);
      return new RegExp(`^(${o.map((r) => Ze(r.source)).join("|")})$`);
    }
  });
  const n = t.options.length === 1 ? t.options[0]._zod.run : null;
  e._zod.parse = (o, r) => {
    if (n)
      return n(o, r);
    let s = !1;
    const i = [];
    for (const c of t.options) {
      const u = c._zod.run({
        value: o.value,
        issues: []
      }, r);
      if (u instanceof Promise)
        i.push(u), s = !0;
      else {
        if (u.issues.length === 0)
          return u;
        i.push(u);
      }
    }
    return s ? Promise.all(i).then((c) => Ne(c, o, e, r)) : Ne(i, o, e, r);
  };
}), Ao = /* @__PURE__ */ a("$ZodIntersection", (e, t) => {
  k.init(e, t), e._zod.parse = (n, o) => {
    const r = n.value, s = t.left._zod.run({ value: r, issues: [] }, o), i = t.right._zod.run({ value: r, issues: [] }, o);
    return s instanceof Promise || i instanceof Promise ? Promise.all([s, i]).then(([u, l]) => He(n, u, l)) : He(n, s, i);
  };
});
function $e(e, t) {
  if (e === t)
    return { valid: !0, data: e };
  if (e instanceof Date && t instanceof Date && +e == +t)
    return { valid: !0, data: e };
  if (q(e) && q(t)) {
    const n = Object.keys(t), o = Object.keys(e).filter((s) => n.indexOf(s) !== -1), r = { ...e, ...t };
    for (const s of o) {
      const i = $e(e[s], t[s]);
      if (!i.valid)
        return {
          valid: !1,
          mergeErrorPath: [s, ...i.mergeErrorPath]
        };
      r[s] = i.data;
    }
    return { valid: !0, data: r };
  }
  if (Array.isArray(e) && Array.isArray(t)) {
    if (e.length !== t.length)
      return { valid: !1, mergeErrorPath: [] };
    const n = [];
    for (let o = 0; o < e.length; o++) {
      const r = e[o], s = t[o], i = $e(r, s);
      if (!i.valid)
        return {
          valid: !1,
          mergeErrorPath: [o, ...i.mergeErrorPath]
        };
      n.push(i.data);
    }
    return { valid: !0, data: n };
  }
  return { valid: !1, mergeErrorPath: [] };
}
function He(e, t, n) {
  const o = /* @__PURE__ */ new Map();
  let r;
  for (const c of t.issues)
    if (c.code === "unrecognized_keys") {
      r ?? (r = c);
      for (const u of c.keys)
        o.has(u) || o.set(u, {}), o.get(u).l = !0;
    } else
      e.issues.push(c);
  for (const c of n.issues)
    if (c.code === "unrecognized_keys")
      for (const u of c.keys)
        o.has(u) || o.set(u, {}), o.get(u).r = !0;
    else
      e.issues.push(c);
  const s = [...o].filter(([, c]) => c.l && c.r).map(([c]) => c);
  if (s.length && r && e.issues.push({ ...r, keys: s }), F(e))
    return e;
  const i = $e(t.value, n.value);
  if (!i.valid)
    throw new Error(`Unmergable intersection. Error path: ${JSON.stringify(i.mergeErrorPath)}`);
  return e.value = i.data, e;
}
const Oo = /* @__PURE__ */ a("$ZodEnum", (e, t) => {
  k.init(e, t);
  const n = it(t.entries), o = new Set(n);
  e._zod.values = o, e._zod.pattern = new RegExp(`^(${n.filter((r) => xt.has(typeof r)).map((r) => typeof r == "string" ? ue(r) : r.toString()).join("|")})$`), e._zod.parse = (r, s) => {
    const i = r.value;
    return o.has(i) || r.issues.push({
      code: "invalid_value",
      values: n,
      input: i,
      inst: e
    }), r;
  };
}), Eo = /* @__PURE__ */ a("$ZodTransform", (e, t) => {
  k.init(e, t), e._zod.optin = "optional", e._zod.parse = (n, o) => {
    if (o.direction === "backward")
      throw new st(e.constructor.name);
    const r = t.transform(n.value, n);
    if (o.async)
      return (r instanceof Promise ? r : Promise.resolve(r)).then((i) => (n.value = i, n.fallback = !0, n));
    if (r instanceof Promise)
      throw new x();
    return n.value = r, n.fallback = !0, n;
  };
});
function Me(e, t) {
  return t === void 0 && (e.issues.length || e.fallback) ? { issues: [], value: void 0 } : e;
}
const $t = /* @__PURE__ */ a("$ZodOptional", (e, t) => {
  k.init(e, t), e._zod.optin = "optional", e._zod.optout = "optional", g(e._zod, "values", () => t.innerType._zod.values ? /* @__PURE__ */ new Set([...t.innerType._zod.values, void 0]) : void 0), g(e._zod, "pattern", () => {
    const n = t.innerType._zod.pattern;
    return n ? new RegExp(`^(${Ze(n.source)})?$`) : void 0;
  }), e._zod.parse = (n, o) => {
    if (t.innerType._zod.optin === "optional") {
      const r = n.value, s = t.innerType._zod.run(n, o);
      return s instanceof Promise ? s.then((i) => Me(i, r)) : Me(s, r);
    }
    return n.value === void 0 ? n : t.innerType._zod.run(n, o);
  };
}), To = /* @__PURE__ */ a("$ZodExactOptional", (e, t) => {
  $t.init(e, t), g(e._zod, "values", () => t.innerType._zod.values), g(e._zod, "pattern", () => t.innerType._zod.pattern), e._zod.parse = (n, o) => t.innerType._zod.run(n, o);
}), Po = /* @__PURE__ */ a("$ZodNullable", (e, t) => {
  k.init(e, t), g(e._zod, "optin", () => t.innerType._zod.optin), g(e._zod, "optout", () => t.innerType._zod.optout), g(e._zod, "pattern", () => {
    const n = t.innerType._zod.pattern;
    return n ? new RegExp(`^(${Ze(n.source)}|null)$`) : void 0;
  }), g(e._zod, "values", () => t.innerType._zod.values ? /* @__PURE__ */ new Set([...t.innerType._zod.values, null]) : void 0), e._zod.parse = (n, o) => n.value === null ? n : t.innerType._zod.run(n, o);
}), Io = /* @__PURE__ */ a("$ZodDefault", (e, t) => {
  k.init(e, t), e._zod.optin = "optional", g(e._zod, "values", () => t.innerType._zod.values), e._zod.parse = (n, o) => {
    if (o.direction === "backward")
      return t.innerType._zod.run(n, o);
    if (n.value === void 0)
      return n.value = t.defaultValue, n;
    const r = t.innerType._zod.run(n, o);
    return r instanceof Promise ? r.then((s) => Fe(s, t)) : Fe(r, t);
  };
});
function Fe(e, t) {
  return e.value === void 0 && (e.value = t.defaultValue), e;
}
const jo = /* @__PURE__ */ a("$ZodPrefault", (e, t) => {
  k.init(e, t), e._zod.optin = "optional", g(e._zod, "values", () => t.innerType._zod.values), e._zod.parse = (n, o) => (o.direction === "backward" || n.value === void 0 && (n.value = t.defaultValue), t.innerType._zod.run(n, o));
}), Wo = /* @__PURE__ */ a("$ZodNonOptional", (e, t) => {
  k.init(e, t), g(e._zod, "values", () => {
    const n = t.innerType._zod.values;
    return n ? new Set([...n].filter((o) => o !== void 0)) : void 0;
  }), e._zod.parse = (n, o) => {
    const r = t.innerType._zod.run(n, o);
    return r instanceof Promise ? r.then((s) => xe(s, e)) : xe(r, e);
  };
});
function xe(e, t) {
  return !e.issues.length && e.value === void 0 && e.issues.push({
    code: "invalid_type",
    expected: "nonoptional",
    input: e.value,
    inst: t
  }), e;
}
const Co = /* @__PURE__ */ a("$ZodCatch", (e, t) => {
  k.init(e, t), e._zod.optin = "optional", g(e._zod, "optout", () => t.innerType._zod.optout), g(e._zod, "values", () => t.innerType._zod.values), e._zod.parse = (n, o) => {
    if (o.direction === "backward")
      return t.innerType._zod.run(n, o);
    const r = t.innerType._zod.run(n, o);
    return r instanceof Promise ? r.then((s) => (n.value = s.value, s.issues.length && (n.value = t.catchValue({
      ...n,
      error: {
        issues: s.issues.map((i) => N(i, o, U()))
      },
      input: n.value
    }), n.issues = [], n.fallback = !0), n)) : (n.value = r.value, r.issues.length && (n.value = t.catchValue({
      ...n,
      error: {
        issues: r.issues.map((s) => N(s, o, U()))
      },
      input: n.value
    }), n.issues = [], n.fallback = !0), n);
  };
}), Ro = /* @__PURE__ */ a("$ZodPipe", (e, t) => {
  k.init(e, t), g(e._zod, "values", () => t.in._zod.values), g(e._zod, "optin", () => t.in._zod.optin), g(e._zod, "optout", () => t.out._zod.optout), g(e._zod, "propValues", () => t.in._zod.propValues), e._zod.parse = (n, o) => {
    if (o.direction === "backward") {
      const s = t.out._zod.run(n, o);
      return s instanceof Promise ? s.then((i) => Q(i, t.in, o)) : Q(s, t.in, o);
    }
    const r = t.in._zod.run(n, o);
    return r instanceof Promise ? r.then((s) => Q(s, t.out, o)) : Q(r, t.out, o);
  };
});
function Q(e, t, n) {
  return e.issues.length ? (e.aborted = !0, e) : t._zod.run({ value: e.value, issues: e.issues, fallback: e.fallback }, n);
}
const Do = /* @__PURE__ */ a("$ZodReadonly", (e, t) => {
  k.init(e, t), g(e._zod, "propValues", () => t.innerType._zod.propValues), g(e._zod, "values", () => t.innerType._zod.values), g(e._zod, "optin", () => {
    var n, o;
    return (o = (n = t.innerType) == null ? void 0 : n._zod) == null ? void 0 : o.optin;
  }), g(e._zod, "optout", () => {
    var n, o;
    return (o = (n = t.innerType) == null ? void 0 : n._zod) == null ? void 0 : o.optout;
  }), e._zod.parse = (n, o) => {
    if (o.direction === "backward")
      return t.innerType._zod.run(n, o);
    const r = t.innerType._zod.run(n, o);
    return r instanceof Promise ? r.then(Je) : Je(r);
  };
});
function Je(e) {
  return e.value = Object.freeze(e.value), e;
}
const Lo = /* @__PURE__ */ a("$ZodCustom", (e, t) => {
  C.init(e, t), k.init(e, t), e._zod.parse = (n, o) => n, e._zod.check = (n) => {
    const o = n.value, r = t.fn(o);
    if (r instanceof Promise)
      return r.then((s) => Ve(s, n, o, e));
    Ve(r, n, o, e);
  };
});
function Ve(e, t, n, o) {
  if (!e) {
    const r = {
      code: "custom",
      input: n,
      inst: o,
      // incorporates params.error into issue reporting
      path: [...o._zod.def.path ?? []],
      // incorporates params.error into issue reporting
      continue: !o._zod.def.abort
      // params: inst._zod.def.params,
    };
    o._zod.def.params && (r.params = o._zod.def.params), t.issues.push(G(r));
  }
}
var Be;
class Uo {
  constructor() {
    this._map = /* @__PURE__ */ new WeakMap(), this._idmap = /* @__PURE__ */ new Map();
  }
  add(t, ...n) {
    const o = n[0];
    return this._map.set(t, o), o && typeof o == "object" && "id" in o && this._idmap.set(o.id, t), this;
  }
  clear() {
    return this._map = /* @__PURE__ */ new WeakMap(), this._idmap = /* @__PURE__ */ new Map(), this;
  }
  remove(t) {
    const n = this._map.get(t);
    return n && typeof n == "object" && "id" in n && this._idmap.delete(n.id), this._map.delete(t), this;
  }
  get(t) {
    const n = t._zod.parent;
    if (n) {
      const o = { ...this.get(n) ?? {} };
      delete o.id;
      const r = { ...o, ...this._map.get(t) };
      return Object.keys(r).length ? r : void 0;
    }
    return this._map.get(t);
  }
  has(t) {
    return this._map.has(t);
  }
}
function No() {
  return new Uo();
}
(Be = globalThis).__zod_globalRegistry ?? (Be.__zod_globalRegistry = No());
const K = globalThis.__zod_globalRegistry;
// @__NO_SIDE_EFFECTS__
function Ho(e, t) {
  return new e({
    type: "string",
    ...m(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Mo(e, t) {
  return new e({
    type: "string",
    format: "email",
    check: "string_format",
    abort: !1,
    ...m(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Ke(e, t) {
  return new e({
    type: "string",
    format: "guid",
    check: "string_format",
    abort: !1,
    ...m(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Fo(e, t) {
  return new e({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: !1,
    ...m(t)
  });
}
// @__NO_SIDE_EFFECTS__
function xo(e, t) {
  return new e({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: !1,
    version: "v4",
    ...m(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Jo(e, t) {
  return new e({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: !1,
    version: "v6",
    ...m(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Vo(e, t) {
  return new e({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: !1,
    version: "v7",
    ...m(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Bo(e, t) {
  return new e({
    type: "string",
    format: "url",
    check: "string_format",
    abort: !1,
    ...m(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Ko(e, t) {
  return new e({
    type: "string",
    format: "emoji",
    check: "string_format",
    abort: !1,
    ...m(t)
  });
}
// @__NO_SIDE_EFFECTS__
function qo(e, t) {
  return new e({
    type: "string",
    format: "nanoid",
    check: "string_format",
    abort: !1,
    ...m(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Go(e, t) {
  return new e({
    type: "string",
    format: "cuid",
    check: "string_format",
    abort: !1,
    ...m(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Xo(e, t) {
  return new e({
    type: "string",
    format: "cuid2",
    check: "string_format",
    abort: !1,
    ...m(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Yo(e, t) {
  return new e({
    type: "string",
    format: "ulid",
    check: "string_format",
    abort: !1,
    ...m(t)
  });
}
// @__NO_SIDE_EFFECTS__
function Qo(e, t) {
  return new e({
    type: "string",
    format: "xid",
    check: "string_format",
    abort: !1,
    ...m(t)
  });
}
// @__NO_SIDE_EFFECTS__
function er(e, t) {
  return new e({
    type: "string",
    format: "ksuid",
    check: "string_format",
    abort: !1,
    ...m(t)
  });
}
// @__NO_SIDE_EFFECTS__
function tr(e, t) {
  return new e({
    type: "string",
    format: "ipv4",
    check: "string_format",
    abort: !1,
    ...m(t)
  });
}
// @__NO_SIDE_EFFECTS__
function nr(e, t) {
  return new e({
    type: "string",
    format: "ipv6",
    check: "string_format",
    abort: !1,
    ...m(t)
  });
}
// @__NO_SIDE_EFFECTS__
function or(e, t) {
  return new e({
    type: "string",
    format: "cidrv4",
    check: "string_format",
    abort: !1,
    ...m(t)
  });
}
// @__NO_SIDE_EFFECTS__
function rr(e, t) {
  return new e({
    type: "string",
    format: "cidrv6",
    check: "string_format",
    abort: !1,
    ...m(t)
  });
}
// @__NO_SIDE_EFFECTS__
function sr(e, t) {
  return new e({
    type: "string",
    format: "base64",
    check: "string_format",
    abort: !1,
    ...m(t)
  });
}
// @__NO_SIDE_EFFECTS__
function ir(e, t) {
  return new e({
    type: "string",
    format: "base64url",
    check: "string_format",
    abort: !1,
    ...m(t)
  });
}
// @__NO_SIDE_EFFECTS__
function cr(e, t) {
  return new e({
    type: "string",
    format: "e164",
    check: "string_format",
    abort: !1,
    ...m(t)
  });
}
// @__NO_SIDE_EFFECTS__
function ar(e, t) {
  return new e({
    type: "string",
    format: "jwt",
    check: "string_format",
    abort: !1,
    ...m(t)
  });
}
// @__NO_SIDE_EFFECTS__
function ur(e, t) {
  return new e({
    type: "string",
    format: "datetime",
    check: "string_format",
    offset: !1,
    local: !1,
    precision: null,
    ...m(t)
  });
}
// @__NO_SIDE_EFFECTS__
function fr(e, t) {
  return new e({
    type: "string",
    format: "date",
    check: "string_format",
    ...m(t)
  });
}
// @__NO_SIDE_EFFECTS__
function lr(e, t) {
  return new e({
    type: "string",
    format: "time",
    check: "string_format",
    precision: null,
    ...m(t)
  });
}
// @__NO_SIDE_EFFECTS__
function dr(e, t) {
  return new e({
    type: "string",
    format: "duration",
    check: "string_format",
    ...m(t)
  });
}
// @__NO_SIDE_EFFECTS__
function pr(e) {
  return new e({
    type: "unknown"
  });
}
// @__NO_SIDE_EFFECTS__
function hr(e, t) {
  return new e({
    type: "never",
    ...m(t)
  });
}
// @__NO_SIDE_EFFECTS__
function yt(e, t) {
  return new Dn({
    check: "max_length",
    ...m(t),
    maximum: e
  });
}
// @__NO_SIDE_EFFECTS__
function ie(e, t) {
  return new Ln({
    check: "min_length",
    ...m(t),
    minimum: e
  });
}
// @__NO_SIDE_EFFECTS__
function vt(e, t) {
  return new Un({
    check: "length_equals",
    ...m(t),
    length: e
  });
}
// @__NO_SIDE_EFFECTS__
function mr(e, t) {
  return new Nn({
    check: "string_format",
    format: "regex",
    ...m(t),
    pattern: e
  });
}
// @__NO_SIDE_EFFECTS__
function _r(e) {
  return new Hn({
    check: "string_format",
    format: "lowercase",
    ...m(e)
  });
}
// @__NO_SIDE_EFFECTS__
function gr(e) {
  return new Mn({
    check: "string_format",
    format: "uppercase",
    ...m(e)
  });
}
// @__NO_SIDE_EFFECTS__
function wr(e, t) {
  return new Fn({
    check: "string_format",
    format: "includes",
    ...m(t),
    includes: e
  });
}
// @__NO_SIDE_EFFECTS__
function $r(e, t) {
  return new xn({
    check: "string_format",
    format: "starts_with",
    ...m(t),
    prefix: e
  });
}
// @__NO_SIDE_EFFECTS__
function yr(e, t) {
  return new Jn({
    check: "string_format",
    format: "ends_with",
    ...m(t),
    suffix: e
  });
}
// @__NO_SIDE_EFFECTS__
function V(e) {
  return new Vn({
    check: "overwrite",
    tx: e
  });
}
// @__NO_SIDE_EFFECTS__
function vr(e) {
  return /* @__PURE__ */ V((t) => t.normalize(e));
}
// @__NO_SIDE_EFFECTS__
function zr() {
  return /* @__PURE__ */ V((e) => e.trim());
}
// @__NO_SIDE_EFFECTS__
function br() {
  return /* @__PURE__ */ V((e) => e.toLowerCase());
}
// @__NO_SIDE_EFFECTS__
function kr() {
  return /* @__PURE__ */ V((e) => e.toUpperCase());
}
// @__NO_SIDE_EFFECTS__
function Zr() {
  return /* @__PURE__ */ V((e) => Mt(e));
}
// @__NO_SIDE_EFFECTS__
function Sr(e, t, n) {
  return new e({
    type: "array",
    element: t,
    // get element() {
    //   return element;
    // },
    ...m(n)
  });
}
// @__NO_SIDE_EFFECTS__
function Ar(e, t, n) {
  return new e({
    type: "custom",
    check: "custom",
    fn: t,
    ...m(n)
  });
}
// @__NO_SIDE_EFFECTS__
function Or(e, t) {
  const n = /* @__PURE__ */ Er((o) => (o.addIssue = (r) => {
    if (typeof r == "string")
      o.issues.push(G(r, o.value, n._zod.def));
    else {
      const s = r;
      s.fatal && (s.continue = !1), s.code ?? (s.code = "custom"), s.input ?? (s.input = o.value), s.inst ?? (s.inst = n), s.continue ?? (s.continue = !n._zod.def.abort), o.issues.push(G(s));
    }
  }, e(o.value, o)), t);
  return n;
}
// @__NO_SIDE_EFFECTS__
function Er(e, t) {
  const n = new C({
    check: "custom",
    ...m(t)
  });
  return n._zod.check = e, n;
}
function zt(e) {
  let t = (e == null ? void 0 : e.target) ?? "draft-2020-12";
  return t === "draft-4" && (t = "draft-04"), t === "draft-7" && (t = "draft-07"), {
    processors: e.processors ?? {},
    metadataRegistry: (e == null ? void 0 : e.metadata) ?? K,
    target: t,
    unrepresentable: (e == null ? void 0 : e.unrepresentable) ?? "throw",
    override: (e == null ? void 0 : e.override) ?? (() => {
    }),
    io: (e == null ? void 0 : e.io) ?? "output",
    counter: 0,
    seen: /* @__PURE__ */ new Map(),
    cycles: (e == null ? void 0 : e.cycles) ?? "ref",
    reused: (e == null ? void 0 : e.reused) ?? "inline",
    external: (e == null ? void 0 : e.external) ?? void 0
  };
}
function O(e, t, n = { path: [], schemaPath: [] }) {
  var f, d;
  var o;
  const r = e._zod.def, s = t.seen.get(e);
  if (s)
    return s.count++, n.schemaPath.includes(e) && (s.cycle = n.path), s.schema;
  const i = { schema: {}, count: 1, cycle: void 0, path: n.path };
  t.seen.set(e, i);
  const c = (d = (f = e._zod).toJSONSchema) == null ? void 0 : d.call(f);
  if (c)
    i.schema = c;
  else {
    const h = {
      ...n,
      schemaPath: [...n.schemaPath, e],
      path: n.path
    };
    if (e._zod.processJSONSchema)
      e._zod.processJSONSchema(t, i.schema, h);
    else {
      const w = i.schema, z = t.processors[r.type];
      if (!z)
        throw new Error(`[toJSONSchema]: Non-representable type encountered: ${r.type}`);
      z(e, t, w, h);
    }
    const p = e._zod.parent;
    p && (i.ref || (i.ref = p), O(p, t, h), t.seen.get(p).isParent = !0);
  }
  const u = t.metadataRegistry.get(e);
  return u && Object.assign(i.schema, u), t.io === "input" && E(e) && (delete i.schema.examples, delete i.schema.default), t.io === "input" && "_prefault" in i.schema && ((o = i.schema).default ?? (o.default = i.schema._prefault)), delete i.schema._prefault, t.seen.get(e).schema;
}
function bt(e, t) {
  var i, c, u, l;
  const n = e.seen.get(t);
  if (!n)
    throw new Error("Unprocessed schema. This is a bug in Zod.");
  const o = /* @__PURE__ */ new Map();
  for (const f of e.seen.entries()) {
    const d = (i = e.metadataRegistry.get(f[0])) == null ? void 0 : i.id;
    if (d) {
      const h = o.get(d);
      if (h && h !== f[0])
        throw new Error(`Duplicate schema id "${d}" detected during JSON Schema conversion. Two different schemas cannot share the same id when converted together.`);
      o.set(d, f[0]);
    }
  }
  const r = (f) => {
    var z;
    const d = e.target === "draft-2020-12" ? "$defs" : "definitions";
    if (e.external) {
      const T = (z = e.external.registry.get(f[0])) == null ? void 0 : z.id, b = e.external.uri ?? ((B) => B);
      if (T)
        return { ref: b(T) };
      const S = f[1].defId ?? f[1].schema.id ?? `schema${e.counter++}`;
      return f[1].defId = S, { defId: S, ref: `${b("__shared")}#/${d}/${S}` };
    }
    if (f[1] === n)
      return { ref: "#" };
    const p = `#/${d}/`, w = f[1].schema.id ?? `__schema${e.counter++}`;
    return { defId: w, ref: p + w };
  }, s = (f) => {
    if (f[1].schema.$ref)
      return;
    const d = f[1], { ref: h, defId: p } = r(f);
    d.def = { ...d.schema }, p && (d.defId = p);
    const w = d.schema;
    for (const z in w)
      delete w[z];
    w.$ref = h;
  };
  if (e.cycles === "throw")
    for (const f of e.seen.entries()) {
      const d = f[1];
      if (d.cycle)
        throw new Error(`Cycle detected: #/${(c = d.cycle) == null ? void 0 : c.join("/")}/<root>

Set the \`cycles\` parameter to \`"ref"\` to resolve cyclical schemas with defs.`);
    }
  for (const f of e.seen.entries()) {
    const d = f[1];
    if (t === f[0]) {
      s(f);
      continue;
    }
    if (e.external) {
      const p = (u = e.external.registry.get(f[0])) == null ? void 0 : u.id;
      if (t !== f[0] && p) {
        s(f);
        continue;
      }
    }
    if ((l = e.metadataRegistry.get(f[0])) == null ? void 0 : l.id) {
      s(f);
      continue;
    }
    if (d.cycle) {
      s(f);
      continue;
    }
    if (d.count > 1 && e.reused === "ref") {
      s(f);
      continue;
    }
  }
}
function kt(e, t) {
  var c, u, l, f;
  const n = e.seen.get(t);
  if (!n)
    throw new Error("Unprocessed schema. This is a bug in Zod.");
  const o = (d) => {
    const h = e.seen.get(d);
    if (h.ref === null)
      return;
    const p = h.def ?? h.schema, w = { ...p }, z = h.ref;
    if (h.ref = null, z) {
      o(z);
      const b = e.seen.get(z), S = b.schema;
      if (S.$ref && (e.target === "draft-07" || e.target === "draft-04" || e.target === "openapi-3.0") ? (p.allOf = p.allOf ?? [], p.allOf.push(S)) : Object.assign(p, S), Object.assign(p, w), d._zod.parent === z)
        for (const P in p)
          P === "$ref" || P === "allOf" || P in w || delete p[P];
      if (S.$ref && b.def)
        for (const P in p)
          P === "$ref" || P === "allOf" || P in b.def && JSON.stringify(p[P]) === JSON.stringify(b.def[P]) && delete p[P];
    }
    const T = d._zod.parent;
    if (T && T !== z) {
      o(T);
      const b = e.seen.get(T);
      if (b != null && b.schema.$ref && (p.$ref = b.schema.$ref, b.def))
        for (const S in p)
          S === "$ref" || S === "allOf" || S in b.def && JSON.stringify(p[S]) === JSON.stringify(b.def[S]) && delete p[S];
    }
    e.override({
      zodSchema: d,
      jsonSchema: p,
      path: h.path ?? []
    });
  };
  for (const d of [...e.seen.entries()].reverse())
    o(d[0]);
  const r = {};
  if (e.target === "draft-2020-12" ? r.$schema = "https://json-schema.org/draft/2020-12/schema" : e.target === "draft-07" ? r.$schema = "http://json-schema.org/draft-07/schema#" : e.target === "draft-04" ? r.$schema = "http://json-schema.org/draft-04/schema#" : e.target, (c = e.external) != null && c.uri) {
    const d = (u = e.external.registry.get(t)) == null ? void 0 : u.id;
    if (!d)
      throw new Error("Schema is missing an `id` property");
    r.$id = e.external.uri(d);
  }
  Object.assign(r, n.def ?? n.schema);
  const s = (l = e.metadataRegistry.get(t)) == null ? void 0 : l.id;
  s !== void 0 && r.id === s && delete r.id;
  const i = ((f = e.external) == null ? void 0 : f.defs) ?? {};
  for (const d of e.seen.entries()) {
    const h = d[1];
    h.def && h.defId && (h.def.id === h.defId && delete h.def.id, i[h.defId] = h.def);
  }
  e.external || Object.keys(i).length > 0 && (e.target === "draft-2020-12" ? r.$defs = i : r.definitions = i);
  try {
    const d = JSON.parse(JSON.stringify(r));
    return Object.defineProperty(d, "~standard", {
      value: {
        ...t["~standard"],
        jsonSchema: {
          input: ce(t, "input", e.processors),
          output: ce(t, "output", e.processors)
        }
      },
      enumerable: !1,
      writable: !1
    }), d;
  } catch {
    throw new Error("Error converting schema to JSON.");
  }
}
function E(e, t) {
  const n = t ?? { seen: /* @__PURE__ */ new Set() };
  if (n.seen.has(e))
    return !1;
  n.seen.add(e);
  const o = e._zod.def;
  if (o.type === "transform")
    return !0;
  if (o.type === "array")
    return E(o.element, n);
  if (o.type === "set")
    return E(o.valueType, n);
  if (o.type === "lazy")
    return E(o.getter(), n);
  if (o.type === "promise" || o.type === "optional" || o.type === "nonoptional" || o.type === "nullable" || o.type === "readonly" || o.type === "default" || o.type === "prefault")
    return E(o.innerType, n);
  if (o.type === "intersection")
    return E(o.left, n) || E(o.right, n);
  if (o.type === "record" || o.type === "map")
    return E(o.keyType, n) || E(o.valueType, n);
  if (o.type === "pipe")
    return e._zod.traits.has("$ZodCodec") ? !0 : E(o.in, n) || E(o.out, n);
  if (o.type === "object") {
    for (const r in o.shape)
      if (E(o.shape[r], n))
        return !0;
    return !1;
  }
  if (o.type === "union") {
    for (const r of o.options)
      if (E(r, n))
        return !0;
    return !1;
  }
  if (o.type === "tuple") {
    for (const r of o.items)
      if (E(r, n))
        return !0;
    return !!(o.rest && E(o.rest, n));
  }
  return !1;
}
const Tr = (e, t = {}) => (n) => {
  const o = zt({ ...n, processors: t });
  return O(e, o), bt(o, e), kt(o, e);
}, ce = (e, t, n = {}) => (o) => {
  const { libraryOptions: r, target: s } = o ?? {}, i = zt({ ...r ?? {}, target: s, io: t, processors: n });
  return O(e, i), bt(i, e), kt(i, e);
}, Pr = {
  guid: "uuid",
  url: "uri",
  datetime: "date-time",
  json_string: "json-string",
  regex: ""
  // do not set
}, Ir = (e, t, n, o) => {
  const r = n;
  r.type = "string";
  const { minimum: s, maximum: i, format: c, patterns: u, contentEncoding: l } = e._zod.bag;
  if (typeof s == "number" && (r.minLength = s), typeof i == "number" && (r.maxLength = i), c && (r.format = Pr[c] ?? c, r.format === "" && delete r.format, c === "time" && delete r.format), l && (r.contentEncoding = l), u && u.size > 0) {
    const f = [...u];
    f.length === 1 ? r.pattern = f[0].source : f.length > 1 && (r.allOf = [
      ...f.map((d) => ({
        ...t.target === "draft-07" || t.target === "draft-04" || t.target === "openapi-3.0" ? { type: "string" } : {},
        pattern: d.source
      }))
    ]);
  }
}, jr = (e, t, n, o) => {
  n.not = {};
}, Wr = (e, t, n, o) => {
}, Cr = (e, t, n, o) => {
  const r = e._zod.def, s = it(r.entries);
  s.every((i) => typeof i == "number") && (n.type = "number"), s.every((i) => typeof i == "string") && (n.type = "string"), n.enum = s;
}, Rr = (e, t, n, o) => {
  if (t.unrepresentable === "throw")
    throw new Error("Custom types cannot be represented in JSON Schema");
}, Dr = (e, t, n, o) => {
  if (t.unrepresentable === "throw")
    throw new Error("Transforms cannot be represented in JSON Schema");
}, Lr = (e, t, n, o) => {
  const r = n, s = e._zod.def, { minimum: i, maximum: c } = e._zod.bag;
  typeof i == "number" && (r.minItems = i), typeof c == "number" && (r.maxItems = c), r.type = "array", r.items = O(s.element, t, {
    ...o,
    path: [...o.path, "items"]
  });
}, Ur = (e, t, n, o) => {
  var l;
  const r = n, s = e._zod.def;
  r.type = "object", r.properties = {};
  const i = s.shape;
  for (const f in i)
    r.properties[f] = O(i[f], t, {
      ...o,
      path: [...o.path, "properties", f]
    });
  const c = new Set(Object.keys(i)), u = new Set([...c].filter((f) => {
    const d = s.shape[f]._zod;
    return t.io === "input" ? d.optin === void 0 : d.optout === void 0;
  }));
  u.size > 0 && (r.required = Array.from(u)), ((l = s.catchall) == null ? void 0 : l._zod.def.type) === "never" ? r.additionalProperties = !1 : s.catchall ? s.catchall && (r.additionalProperties = O(s.catchall, t, {
    ...o,
    path: [...o.path, "additionalProperties"]
  })) : t.io === "output" && (r.additionalProperties = !1);
}, Nr = (e, t, n, o) => {
  const r = e._zod.def, s = r.inclusive === !1, i = r.options.map((c, u) => O(c, t, {
    ...o,
    path: [...o.path, s ? "oneOf" : "anyOf", u]
  }));
  s ? n.oneOf = i : n.anyOf = i;
}, Hr = (e, t, n, o) => {
  const r = e._zod.def, s = O(r.left, t, {
    ...o,
    path: [...o.path, "allOf", 0]
  }), i = O(r.right, t, {
    ...o,
    path: [...o.path, "allOf", 1]
  }), c = (l) => "allOf" in l && Object.keys(l).length === 1, u = [
    ...c(s) ? s.allOf : [s],
    ...c(i) ? i.allOf : [i]
  ];
  n.allOf = u;
}, Mr = (e, t, n, o) => {
  const r = e._zod.def, s = O(r.innerType, t, o), i = t.seen.get(e);
  t.target === "openapi-3.0" ? (i.ref = r.innerType, n.nullable = !0) : n.anyOf = [s, { type: "null" }];
}, Fr = (e, t, n, o) => {
  const r = e._zod.def;
  O(r.innerType, t, o);
  const s = t.seen.get(e);
  s.ref = r.innerType;
}, xr = (e, t, n, o) => {
  const r = e._zod.def;
  O(r.innerType, t, o);
  const s = t.seen.get(e);
  s.ref = r.innerType, n.default = JSON.parse(JSON.stringify(r.defaultValue));
}, Jr = (e, t, n, o) => {
  const r = e._zod.def;
  O(r.innerType, t, o);
  const s = t.seen.get(e);
  s.ref = r.innerType, t.io === "input" && (n._prefault = JSON.parse(JSON.stringify(r.defaultValue)));
}, Vr = (e, t, n, o) => {
  const r = e._zod.def;
  O(r.innerType, t, o);
  const s = t.seen.get(e);
  s.ref = r.innerType;
  let i;
  try {
    i = r.catchValue(void 0);
  } catch {
    throw new Error("Dynamic catch values are not supported in JSON Schema");
  }
  n.default = i;
}, Br = (e, t, n, o) => {
  const r = e._zod.def, s = r.in._zod.traits.has("$ZodTransform"), i = t.io === "input" ? s ? r.out : r.in : r.out;
  O(i, t, o);
  const c = t.seen.get(e);
  c.ref = i;
}, Kr = (e, t, n, o) => {
  const r = e._zod.def;
  O(r.innerType, t, o);
  const s = t.seen.get(e);
  s.ref = r.innerType, n.readOnly = !0;
}, Zt = (e, t, n, o) => {
  const r = e._zod.def;
  O(r.innerType, t, o);
  const s = t.seen.get(e);
  s.ref = r.innerType;
}, qr = /* @__PURE__ */ a("ZodISODateTime", (e, t) => {
  io.init(e, t), y.init(e, t);
});
function Gr(e) {
  return /* @__PURE__ */ ur(qr, e);
}
const Xr = /* @__PURE__ */ a("ZodISODate", (e, t) => {
  co.init(e, t), y.init(e, t);
});
function Yr(e) {
  return /* @__PURE__ */ fr(Xr, e);
}
const Qr = /* @__PURE__ */ a("ZodISOTime", (e, t) => {
  ao.init(e, t), y.init(e, t);
});
function es(e) {
  return /* @__PURE__ */ lr(Qr, e);
}
const ts = /* @__PURE__ */ a("ZodISODuration", (e, t) => {
  uo.init(e, t), y.init(e, t);
});
function ns(e) {
  return /* @__PURE__ */ dr(ts, e);
}
const os = (e, t) => {
  lt.init(e, t), e.name = "ZodError", Object.defineProperties(e, {
    format: {
      value: (n) => tn(e, n)
      // enumerable: false,
    },
    flatten: {
      value: (n) => en(e, n)
      // enumerable: false,
    },
    addIssue: {
      value: (n) => {
        e.issues.push(n), e.message = JSON.stringify(e.issues, we, 2);
      }
      // enumerable: false,
    },
    addIssues: {
      value: (n) => {
        e.issues.push(...n), e.message = JSON.stringify(e.issues, we, 2);
      }
      // enumerable: false,
    },
    isEmpty: {
      get() {
        return e.issues.length === 0;
      }
      // enumerable: false,
    }
  });
}, I = /* @__PURE__ */ a("ZodError", os, {
  Parent: Error
}), rs = /* @__PURE__ */ Ae(I), ss = /* @__PURE__ */ Oe(I), is = /* @__PURE__ */ fe(I), cs = /* @__PURE__ */ le(I), as = /* @__PURE__ */ rn(I), us = /* @__PURE__ */ sn(I), fs = /* @__PURE__ */ cn(I), ls = /* @__PURE__ */ an(I), ds = /* @__PURE__ */ un(I), ps = /* @__PURE__ */ fn(I), hs = /* @__PURE__ */ ln(I), ms = /* @__PURE__ */ dn(I), qe = /* @__PURE__ */ new WeakMap();
function pe(e, t, n) {
  const o = Object.getPrototypeOf(e);
  let r = qe.get(o);
  if (r || (r = /* @__PURE__ */ new Set(), qe.set(o, r)), !r.has(t)) {
    r.add(t);
    for (const s in n) {
      const i = n[s];
      Object.defineProperty(o, s, {
        configurable: !0,
        enumerable: !1,
        get() {
          const c = i.bind(this);
          return Object.defineProperty(this, s, {
            configurable: !0,
            writable: !0,
            enumerable: !0,
            value: c
          }), c;
        },
        set(c) {
          Object.defineProperty(this, s, {
            configurable: !0,
            writable: !0,
            enumerable: !0,
            value: c
          });
        }
      });
    }
  }
}
const Z = /* @__PURE__ */ a("ZodType", (e, t) => (k.init(e, t), Object.assign(e["~standard"], {
  jsonSchema: {
    input: ce(e, "input"),
    output: ce(e, "output")
  }
}), e.toJSONSchema = Tr(e, {}), e.def = t, e.type = t.type, Object.defineProperty(e, "_def", { value: t }), e.parse = (n, o) => rs(e, n, o, { callee: e.parse }), e.safeParse = (n, o) => is(e, n, o), e.parseAsync = async (n, o) => ss(e, n, o, { callee: e.parseAsync }), e.safeParseAsync = async (n, o) => cs(e, n, o), e.spa = e.safeParseAsync, e.encode = (n, o) => as(e, n, o), e.decode = (n, o) => us(e, n, o), e.encodeAsync = async (n, o) => fs(e, n, o), e.decodeAsync = async (n, o) => ls(e, n, o), e.safeEncode = (n, o) => ds(e, n, o), e.safeDecode = (n, o) => ps(e, n, o), e.safeEncodeAsync = async (n, o) => hs(e, n, o), e.safeDecodeAsync = async (n, o) => ms(e, n, o), pe(e, "ZodType", {
  check(...n) {
    const o = this.def;
    return this.clone(D(o, {
      checks: [
        ...o.checks ?? [],
        ...n.map((r) => typeof r == "function" ? { _zod: { check: r, def: { check: "custom" }, onattach: [] } } : r)
      ]
    }), { parent: !0 });
  },
  with(...n) {
    return this.check(...n);
  },
  clone(n, o) {
    return L(this, n, o);
  },
  brand() {
    return this;
  },
  register(n, o) {
    return n.add(this, o), this;
  },
  refine(n, o) {
    return this.check(ii(n, o));
  },
  superRefine(n, o) {
    return this.check(ci(n, o));
  },
  overwrite(n) {
    return this.check(/* @__PURE__ */ V(n));
  },
  optional() {
    return Ye(this);
  },
  exactOptional() {
    return Bs(this);
  },
  nullable() {
    return Qe(this);
  },
  nullish() {
    return Ye(Qe(this));
  },
  nonoptional(n) {
    return Qs(this, n);
  },
  array() {
    return Te(this);
  },
  or(n) {
    return Ns([this, n]);
  },
  and(n) {
    return Ms(this, n);
  },
  transform(n) {
    return et(this, Js(n));
  },
  default(n) {
    return Gs(this, n);
  },
  prefault(n) {
    return Ys(this, n);
  },
  catch(n) {
    return ti(this, n);
  },
  pipe(n) {
    return et(this, n);
  },
  readonly() {
    return ri(this);
  },
  describe(n) {
    const o = this.clone();
    return K.add(o, { description: n }), o;
  },
  meta(...n) {
    if (n.length === 0)
      return K.get(this);
    const o = this.clone();
    return K.add(o, n[0]), o;
  },
  isOptional() {
    return this.safeParse(void 0).success;
  },
  isNullable() {
    return this.safeParse(null).success;
  },
  apply(n) {
    return n(this);
  }
}), Object.defineProperty(e, "description", {
  get() {
    var n;
    return (n = K.get(e)) == null ? void 0 : n.description;
  },
  configurable: !0
}), e)), St = /* @__PURE__ */ a("_ZodString", (e, t) => {
  Ee.init(e, t), Z.init(e, t), e._zod.processJSONSchema = (o, r, s) => Ir(e, o, r);
  const n = e._zod.bag;
  e.format = n.format ?? null, e.minLength = n.minimum ?? null, e.maxLength = n.maximum ?? null, pe(e, "_ZodString", {
    regex(...o) {
      return this.check(/* @__PURE__ */ mr(...o));
    },
    includes(...o) {
      return this.check(/* @__PURE__ */ wr(...o));
    },
    startsWith(...o) {
      return this.check(/* @__PURE__ */ $r(...o));
    },
    endsWith(...o) {
      return this.check(/* @__PURE__ */ yr(...o));
    },
    min(...o) {
      return this.check(/* @__PURE__ */ ie(...o));
    },
    max(...o) {
      return this.check(/* @__PURE__ */ yt(...o));
    },
    length(...o) {
      return this.check(/* @__PURE__ */ vt(...o));
    },
    nonempty(...o) {
      return this.check(/* @__PURE__ */ ie(1, ...o));
    },
    lowercase(o) {
      return this.check(/* @__PURE__ */ _r(o));
    },
    uppercase(o) {
      return this.check(/* @__PURE__ */ gr(o));
    },
    trim() {
      return this.check(/* @__PURE__ */ zr());
    },
    normalize(...o) {
      return this.check(/* @__PURE__ */ vr(...o));
    },
    toLowerCase() {
      return this.check(/* @__PURE__ */ br());
    },
    toUpperCase() {
      return this.check(/* @__PURE__ */ kr());
    },
    slugify() {
      return this.check(/* @__PURE__ */ Zr());
    }
  });
}), _s = /* @__PURE__ */ a("ZodString", (e, t) => {
  Ee.init(e, t), St.init(e, t), e.email = (n) => e.check(/* @__PURE__ */ Mo(gs, n)), e.url = (n) => e.check(/* @__PURE__ */ Bo(ws, n)), e.jwt = (n) => e.check(/* @__PURE__ */ ar(js, n)), e.emoji = (n) => e.check(/* @__PURE__ */ Ko($s, n)), e.guid = (n) => e.check(/* @__PURE__ */ Ke(Ge, n)), e.uuid = (n) => e.check(/* @__PURE__ */ Fo(ee, n)), e.uuidv4 = (n) => e.check(/* @__PURE__ */ xo(ee, n)), e.uuidv6 = (n) => e.check(/* @__PURE__ */ Jo(ee, n)), e.uuidv7 = (n) => e.check(/* @__PURE__ */ Vo(ee, n)), e.nanoid = (n) => e.check(/* @__PURE__ */ qo(ys, n)), e.guid = (n) => e.check(/* @__PURE__ */ Ke(Ge, n)), e.cuid = (n) => e.check(/* @__PURE__ */ Go(vs, n)), e.cuid2 = (n) => e.check(/* @__PURE__ */ Xo(zs, n)), e.ulid = (n) => e.check(/* @__PURE__ */ Yo(bs, n)), e.base64 = (n) => e.check(/* @__PURE__ */ sr(Ts, n)), e.base64url = (n) => e.check(/* @__PURE__ */ ir(Ps, n)), e.xid = (n) => e.check(/* @__PURE__ */ Qo(ks, n)), e.ksuid = (n) => e.check(/* @__PURE__ */ er(Zs, n)), e.ipv4 = (n) => e.check(/* @__PURE__ */ tr(Ss, n)), e.ipv6 = (n) => e.check(/* @__PURE__ */ nr(As, n)), e.cidrv4 = (n) => e.check(/* @__PURE__ */ or(Os, n)), e.cidrv6 = (n) => e.check(/* @__PURE__ */ rr(Es, n)), e.e164 = (n) => e.check(/* @__PURE__ */ cr(Is, n)), e.datetime = (n) => e.check(Gr(n)), e.date = (n) => e.check(Yr(n)), e.time = (n) => e.check(es(n)), e.duration = (n) => e.check(ns(n));
});
function J(e) {
  return /* @__PURE__ */ Ho(_s, e);
}
const y = /* @__PURE__ */ a("ZodStringFormat", (e, t) => {
  $.init(e, t), St.init(e, t);
}), gs = /* @__PURE__ */ a("ZodEmail", (e, t) => {
  Xn.init(e, t), y.init(e, t);
}), Ge = /* @__PURE__ */ a("ZodGUID", (e, t) => {
  qn.init(e, t), y.init(e, t);
}), ee = /* @__PURE__ */ a("ZodUUID", (e, t) => {
  Gn.init(e, t), y.init(e, t);
}), ws = /* @__PURE__ */ a("ZodURL", (e, t) => {
  Yn.init(e, t), y.init(e, t);
}), $s = /* @__PURE__ */ a("ZodEmoji", (e, t) => {
  Qn.init(e, t), y.init(e, t);
}), ys = /* @__PURE__ */ a("ZodNanoID", (e, t) => {
  eo.init(e, t), y.init(e, t);
}), vs = /* @__PURE__ */ a("ZodCUID", (e, t) => {
  to.init(e, t), y.init(e, t);
}), zs = /* @__PURE__ */ a("ZodCUID2", (e, t) => {
  no.init(e, t), y.init(e, t);
}), bs = /* @__PURE__ */ a("ZodULID", (e, t) => {
  oo.init(e, t), y.init(e, t);
}), ks = /* @__PURE__ */ a("ZodXID", (e, t) => {
  ro.init(e, t), y.init(e, t);
}), Zs = /* @__PURE__ */ a("ZodKSUID", (e, t) => {
  so.init(e, t), y.init(e, t);
}), Ss = /* @__PURE__ */ a("ZodIPv4", (e, t) => {
  fo.init(e, t), y.init(e, t);
}), As = /* @__PURE__ */ a("ZodIPv6", (e, t) => {
  lo.init(e, t), y.init(e, t);
}), Os = /* @__PURE__ */ a("ZodCIDRv4", (e, t) => {
  po.init(e, t), y.init(e, t);
}), Es = /* @__PURE__ */ a("ZodCIDRv6", (e, t) => {
  ho.init(e, t), y.init(e, t);
}), Ts = /* @__PURE__ */ a("ZodBase64", (e, t) => {
  mo.init(e, t), y.init(e, t);
}), Ps = /* @__PURE__ */ a("ZodBase64URL", (e, t) => {
  go.init(e, t), y.init(e, t);
}), Is = /* @__PURE__ */ a("ZodE164", (e, t) => {
  wo.init(e, t), y.init(e, t);
}), js = /* @__PURE__ */ a("ZodJWT", (e, t) => {
  yo.init(e, t), y.init(e, t);
}), Ws = /* @__PURE__ */ a("ZodUnknown", (e, t) => {
  vo.init(e, t), Z.init(e, t), e._zod.processJSONSchema = (n, o, r) => Wr();
});
function Xe() {
  return /* @__PURE__ */ pr(Ws);
}
const Cs = /* @__PURE__ */ a("ZodNever", (e, t) => {
  zo.init(e, t), Z.init(e, t), e._zod.processJSONSchema = (n, o, r) => jr(e, n, o);
});
function Rs(e) {
  return /* @__PURE__ */ hr(Cs, e);
}
const Ds = /* @__PURE__ */ a("ZodArray", (e, t) => {
  bo.init(e, t), Z.init(e, t), e._zod.processJSONSchema = (n, o, r) => Lr(e, n, o, r), e.element = t.element, pe(e, "ZodArray", {
    min(n, o) {
      return this.check(/* @__PURE__ */ ie(n, o));
    },
    nonempty(n) {
      return this.check(/* @__PURE__ */ ie(1, n));
    },
    max(n, o) {
      return this.check(/* @__PURE__ */ yt(n, o));
    },
    length(n, o) {
      return this.check(/* @__PURE__ */ vt(n, o));
    },
    unwrap() {
      return this.element;
    }
  });
});
function Te(e, t) {
  return /* @__PURE__ */ Sr(Ds, e, t);
}
const Ls = /* @__PURE__ */ a("ZodObject", (e, t) => {
  Zo.init(e, t), Z.init(e, t), e._zod.processJSONSchema = (n, o, r) => Ur(e, n, o, r), g(e, "shape", () => t.shape), pe(e, "ZodObject", {
    keyof() {
      return Fs(Object.keys(this._zod.def.shape));
    },
    catchall(n) {
      return this.clone({ ...this._zod.def, catchall: n });
    },
    passthrough() {
      return this.clone({ ...this._zod.def, catchall: Xe() });
    },
    loose() {
      return this.clone({ ...this._zod.def, catchall: Xe() });
    },
    strict() {
      return this.clone({ ...this._zod.def, catchall: Rs() });
    },
    strip() {
      return this.clone({ ...this._zod.def, catchall: void 0 });
    },
    extend(n) {
      return Kt(this, n);
    },
    safeExtend(n) {
      return qt(this, n);
    },
    merge(n) {
      return Gt(this, n);
    },
    pick(n) {
      return Vt(this, n);
    },
    omit(n) {
      return Bt(this, n);
    },
    partial(...n) {
      return Xt(Ot, this, n[0]);
    },
    required(...n) {
      return Yt(Et, this, n[0]);
    }
  });
});
function At(e, t) {
  const n = {
    type: "object",
    shape: e ?? {},
    ...m(t)
  };
  return new Ls(n);
}
const Us = /* @__PURE__ */ a("ZodUnion", (e, t) => {
  So.init(e, t), Z.init(e, t), e._zod.processJSONSchema = (n, o, r) => Nr(e, n, o, r), e.options = t.options;
});
function Ns(e, t) {
  return new Us({
    type: "union",
    options: e,
    ...m(t)
  });
}
const Hs = /* @__PURE__ */ a("ZodIntersection", (e, t) => {
  Ao.init(e, t), Z.init(e, t), e._zod.processJSONSchema = (n, o, r) => Hr(e, n, o, r);
});
function Ms(e, t) {
  return new Hs({
    type: "intersection",
    left: e,
    right: t
  });
}
const ye = /* @__PURE__ */ a("ZodEnum", (e, t) => {
  Oo.init(e, t), Z.init(e, t), e._zod.processJSONSchema = (o, r, s) => Cr(e, o, r), e.enum = t.entries, e.options = Object.values(t.entries);
  const n = new Set(Object.keys(t.entries));
  e.extract = (o, r) => {
    const s = {};
    for (const i of o)
      if (n.has(i))
        s[i] = t.entries[i];
      else
        throw new Error(`Key ${i} not found in enum`);
    return new ye({
      ...t,
      checks: [],
      ...m(r),
      entries: s
    });
  }, e.exclude = (o, r) => {
    const s = { ...t.entries };
    for (const i of o)
      if (n.has(i))
        delete s[i];
      else
        throw new Error(`Key ${i} not found in enum`);
    return new ye({
      ...t,
      checks: [],
      ...m(r),
      entries: s
    });
  };
});
function Fs(e, t) {
  const n = Array.isArray(e) ? Object.fromEntries(e.map((o) => [o, o])) : e;
  return new ye({
    type: "enum",
    entries: n,
    ...m(t)
  });
}
const xs = /* @__PURE__ */ a("ZodTransform", (e, t) => {
  Eo.init(e, t), Z.init(e, t), e._zod.processJSONSchema = (n, o, r) => Dr(e, n), e._zod.parse = (n, o) => {
    if (o.direction === "backward")
      throw new st(e.constructor.name);
    n.addIssue = (s) => {
      if (typeof s == "string")
        n.issues.push(G(s, n.value, t));
      else {
        const i = s;
        i.fatal && (i.continue = !1), i.code ?? (i.code = "custom"), i.input ?? (i.input = n.value), i.inst ?? (i.inst = e), n.issues.push(G(i));
      }
    };
    const r = t.transform(n.value, n);
    return r instanceof Promise ? r.then((s) => (n.value = s, n.fallback = !0, n)) : (n.value = r, n.fallback = !0, n);
  };
});
function Js(e) {
  return new xs({
    type: "transform",
    transform: e
  });
}
const Ot = /* @__PURE__ */ a("ZodOptional", (e, t) => {
  $t.init(e, t), Z.init(e, t), e._zod.processJSONSchema = (n, o, r) => Zt(e, n, o, r), e.unwrap = () => e._zod.def.innerType;
});
function Ye(e) {
  return new Ot({
    type: "optional",
    innerType: e
  });
}
const Vs = /* @__PURE__ */ a("ZodExactOptional", (e, t) => {
  To.init(e, t), Z.init(e, t), e._zod.processJSONSchema = (n, o, r) => Zt(e, n, o, r), e.unwrap = () => e._zod.def.innerType;
});
function Bs(e) {
  return new Vs({
    type: "optional",
    innerType: e
  });
}
const Ks = /* @__PURE__ */ a("ZodNullable", (e, t) => {
  Po.init(e, t), Z.init(e, t), e._zod.processJSONSchema = (n, o, r) => Mr(e, n, o, r), e.unwrap = () => e._zod.def.innerType;
});
function Qe(e) {
  return new Ks({
    type: "nullable",
    innerType: e
  });
}
const qs = /* @__PURE__ */ a("ZodDefault", (e, t) => {
  Io.init(e, t), Z.init(e, t), e._zod.processJSONSchema = (n, o, r) => xr(e, n, o, r), e.unwrap = () => e._zod.def.innerType, e.removeDefault = e.unwrap;
});
function Gs(e, t) {
  return new qs({
    type: "default",
    innerType: e,
    get defaultValue() {
      return typeof t == "function" ? t() : at(t);
    }
  });
}
const Xs = /* @__PURE__ */ a("ZodPrefault", (e, t) => {
  jo.init(e, t), Z.init(e, t), e._zod.processJSONSchema = (n, o, r) => Jr(e, n, o, r), e.unwrap = () => e._zod.def.innerType;
});
function Ys(e, t) {
  return new Xs({
    type: "prefault",
    innerType: e,
    get defaultValue() {
      return typeof t == "function" ? t() : at(t);
    }
  });
}
const Et = /* @__PURE__ */ a("ZodNonOptional", (e, t) => {
  Wo.init(e, t), Z.init(e, t), e._zod.processJSONSchema = (n, o, r) => Fr(e, n, o, r), e.unwrap = () => e._zod.def.innerType;
});
function Qs(e, t) {
  return new Et({
    type: "nonoptional",
    innerType: e,
    ...m(t)
  });
}
const ei = /* @__PURE__ */ a("ZodCatch", (e, t) => {
  Co.init(e, t), Z.init(e, t), e._zod.processJSONSchema = (n, o, r) => Vr(e, n, o, r), e.unwrap = () => e._zod.def.innerType, e.removeCatch = e.unwrap;
});
function ti(e, t) {
  return new ei({
    type: "catch",
    innerType: e,
    catchValue: typeof t == "function" ? t : () => t
  });
}
const ni = /* @__PURE__ */ a("ZodPipe", (e, t) => {
  Ro.init(e, t), Z.init(e, t), e._zod.processJSONSchema = (n, o, r) => Br(e, n, o, r), e.in = t.in, e.out = t.out;
});
function et(e, t) {
  return new ni({
    type: "pipe",
    in: e,
    out: t
    // ...util.normalizeParams(params),
  });
}
const oi = /* @__PURE__ */ a("ZodReadonly", (e, t) => {
  Do.init(e, t), Z.init(e, t), e._zod.processJSONSchema = (n, o, r) => Kr(e, n, o, r), e.unwrap = () => e._zod.def.innerType;
});
function ri(e) {
  return new oi({
    type: "readonly",
    innerType: e
  });
}
const si = /* @__PURE__ */ a("ZodCustom", (e, t) => {
  Lo.init(e, t), Z.init(e, t), e._zod.processJSONSchema = (n, o, r) => Rr(e, n);
});
function ii(e, t = {}) {
  return /* @__PURE__ */ Ar(si, e, t);
}
function ci(e, t) {
  return /* @__PURE__ */ Or(e, t);
}
const te = Nt(oe), Tt = W.dirname(Ht(import.meta.url));
process.env.APP_ROOT = W.join(Tt, "..");
const ve = process.env.VITE_DEV_SERVER_URL, ki = W.join(process.env.APP_ROOT, "dist-electron"), Pt = W.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = ve ? W.join(process.env.APP_ROOT, "public") : Pt;
let _ = null, ne = null, It = !0, Pe = !1, ae = "#0078D4";
R.on("before-quit", () => {
  Pe = !0;
});
X.on("update-general-settings", (e, t) => {
  typeof t.keepInTray == "boolean" && (It = t.keepInTray), typeof t.startAtLogin == "boolean" && R.setLoginItemSettings({ openAtLogin: t.startAtLogin });
});
function ai() {
  const e = W.join(process.env.VITE_PUBLIC, "electron-vite.svg");
  let t = We.createFromPath(e);
  t.isEmpty() && (t = We.createFromDataURL("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAGFJREFUOE9jZKAQMFKon2HUAAaGGyA2N/8H4sFozEg3AKYIrzFIBgP5sBqMboBsM0hxiG4ATHHIAcMFGBmRzCBF3FAzSAEDAwOjgOERx8AoGoRygxgXY2REYvFIM4iSAQAA7X0/wT9P1JcAAAAASUVORK5CYII=")), ne = new Lt(t);
  const n = Ut.buildFromTemplate([
    { label: "Show LazyCow", click: () => _ == null ? void 0 : _.show() },
    { label: "Quit", click: () => {
      Pe = !0, R.quit();
    } }
  ]);
  ne.setToolTip("LazyCow"), ne.setContextMenu(n), ne.on("click", () => _ == null ? void 0 : _.show());
}
function jt() {
  _ = new rt({
    icon: W.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: W.join(Tt, "preload.mjs"),
      contextIsolation: !0,
      nodeIntegration: !1,
      sandbox: !0,
      webSecurity: !0
    }
  }), _.on("close", (e) => {
    It && !Pe && (e.preventDefault(), _ == null || _.hide());
  }), _.webContents.on("did-finish-load", () => {
    _ == null || _.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString()), Wt(), setTimeout(() => ui(), 500);
  }), _.on("focus", () => {
    setTimeout(() => fi(), 300);
  }), ve ? _.loadURL(ve) : _.loadFile(W.join(Pt, "index.html"));
}
function Wt() {
  if (!_) return;
  const e = ot.shouldUseDarkColors;
  _.webContents.send("system-theme", e ? "dark" : "light");
}
ot.on("updated", () => {
  Wt();
});
function Ie() {
  return new Promise((e) => {
    oe(`powershell.exe -Command "$bytes = (Get-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Accent' -Name AccentPalette).AccentPalette; $r = $bytes[12]; $g = $bytes[13]; $b = $bytes[14]; '{0:X2}{1:X2}{2:X2}' -f $r, $g, $b"`, { windowsHide: !0, timeout: 5e3 }, (n, o) => {
      if (!n && o) {
        const r = o.trim().toUpperCase();
        if (/^[0-9A-F]{6}$/.test(r)) {
          console.log("AccentPalette index 3 color:", r), e(`#${r}`);
          return;
        }
      }
      e(ae);
    });
  });
}
async function ui() {
  if (!_) return;
  const e = await Ie();
  ae = e, _.webContents.send("system-accent", e);
}
async function fi() {
  if (!_) return;
  const e = await Ie();
  e !== ae && (ae = e, _.webContents.send("system-accent", e));
}
X.handle("get-system-accent", async () => await Ie());
const li = At({
  id: J().min(1).max(100),
  type: J().min(1).max(50),
  value: J().max(8192)
}).passthrough(), Ct = At({
  id: J().min(1).max(100),
  name: J().min(1).max(200),
  hotkey: J().max(100).optional(),
  actions: Te(li).max(50)
}).passthrough(), di = /* @__PURE__ */ new Set(["toggle_dnd", "toggle_nightlight", "set_brightness"]), me = /* @__PURE__ */ new Set();
async function pi(e) {
  if (di.has(e.type))
    throw new Error(`"${e.type}" isn't implemented yet`);
  switch (e.type) {
    case "launch_app": {
      let t;
      try {
        t = ge.statSync(e.value);
      } catch {
        throw new Error("Path does not exist or is inaccessible");
      }
      if (t.isDirectory()) throw new Error("Path is a directory, not an application");
      const n = W.extname(e.value).toLowerCase();
      if (![".exe", ".cmd", ".bat", ".app"].includes(n) && process.platform === "win32")
        throw new Error("Path is not a recognized executable extension");
      const o = await he.openPath(e.value);
      if (o) throw new Error(o);
      return;
    }
    case "open_folder":
    case "open_file": {
      try {
        ge.statSync(e.value);
      } catch {
        throw new Error("Path does not exist or is inaccessible");
      }
      const t = await he.openPath(e.value);
      if (t) throw new Error(t);
      return;
    }
    case "open_url": {
      if (!/^https?:\/\//i.test(e.value)) throw new Error("Only http:// and https:// URLs are allowed");
      await he.openExternal(e.value);
      return;
    }
    case "open_vscode": {
      try {
        const t = process.platform === "win32" ? "where code" : "which code";
        await te(t, { windowsHide: !0 });
      } catch {
        throw new Error('VS Code CLI "code" is not available in PATH');
      }
      await te(`code "${e.value.replace(/"/g, '\\"')}"`, { windowsHide: !0, timeout: 15e3 });
      return;
    }
    case "set_volume": {
      const t = Number(e.value);
      throw !Number.isInteger(t) || t < 0 || t > 100 ? new Error("Volume must be an integer between 0 and 100") : new Error(`"${e.type}" isn't implemented yet`);
    }
    case "arrange_windows": {
      let t = "snap_left", n = "vertical", o = { tl: "", tr: "", bl: "", br: "" };
      try {
        if (e.value.startsWith("{")) {
          const r = JSON.parse(e.value);
          t = r.layout || "snap_left", n = r.orientation || "vertical", o = r.apps || o;
        } else
          t = e.value;
      } catch {
      }
      if (process.platform === "darwin") {
        const r = `
        tell application "Finder"
            set desktopBounds to bounds of window of desktop
            set screenW to item 3 of desktopBounds
            set screenH to item 4 of desktopBounds
        end tell
        set halfW to screenW / 2
        set halfH to screenH / 2
        tell application "System Events"
            if "${t}" = "quad" then
                ${o.tl ? `try 
 set p to first application process whose name contains "${o.tl}" 
 set position of front window of p to {0, 25} 
 set size of front window of p to {halfW, halfH - 12} 
 end try` : ""}
                ${o.tr ? `try 
 set p to first application process whose name contains "${o.tr}" 
 set position of front window of p to {halfW, 25} 
 set size of front window of p to {halfW, halfH - 12} 
 end try` : ""}
                ${o.bl ? `try 
 set p to first application process whose name contains "${o.bl}" 
 set position of front window of p to {0, 25 + halfH - 12} 
 set size of front window of p to {halfW, halfH - 12} 
 end try` : ""}
                ${o.br ? `try 
 set p to first application process whose name contains "${o.br}" 
 set position of front window of p to {halfW, 25 + halfH - 12} 
 set size of front window of p to {halfW, halfH - 12} 
 end try` : ""}
            else if "${t}" = "split_specific" then
                if "${n}" = "horizontal" then
                    ${o.tl ? `try 
 set p to first application process whose name contains "${o.tl}" 
 set position of front window of p to {0, 25} 
 set size of front window of p to {screenW, halfH - 12} 
 end try` : ""}
                    ${o.tr ? `try 
 set p to first application process whose name contains "${o.tr}" 
 set position of front window of p to {0, 25 + halfH - 12} 
 set size of front window of p to {screenW, halfH - 12} 
 end try` : ""}
                else
                    ${o.tl ? `try 
 set p to first application process whose name contains "${o.tl}" 
 set position of front window of p to {0, 25} 
 set size of front window of p to {halfW, screenH - 25} 
 end try` : ""}
                    ${o.tr ? `try 
 set p to first application process whose name contains "${o.tr}" 
 set position of front window of p to {halfW, 25} 
 set size of front window of p to {halfW, screenH - 25} 
 end try` : ""}
                end if
            else if "${t}" = "tri" then
                if "${n}" = "main_right" then
                    ${o.tl ? `try 
 set p to first application process whose name contains "${o.tl}" 
 set position of front window of p to {0, 25} 
 set size of front window of p to {halfW, halfH - 12} 
 end try` : ""}
                    ${o.bl ? `try 
 set p to first application process whose name contains "${o.bl}" 
 set position of front window of p to {0, 25 + halfH - 12} 
 set size of front window of p to {halfW, halfH - 12} 
 end try` : ""}
                    ${o.tr ? `try 
 set p to first application process whose name contains "${o.tr}" 
 set position of front window of p to {halfW, 25} 
 set size of front window of p to {halfW, screenH - 25} 
 end try` : ""}
                else if "${n}" = "main_top" then
                    ${o.tl ? `try 
 set p to first application process whose name contains "${o.tl}" 
 set position of front window of p to {0, 25} 
 set size of front window of p to {screenW, halfH - 12} 
 end try` : ""}
                    ${o.bl ? `try 
 set p to first application process whose name contains "${o.bl}" 
 set position of front window of p to {0, 25 + halfH - 12} 
 set size of front window of p to {halfW, halfH - 12} 
 end try` : ""}
                    ${o.br ? `try 
 set p to first application process whose name contains "${o.br}" 
 set position of front window of p to {halfW, 25 + halfH - 12} 
 set size of front window of p to {halfW, halfH - 12} 
 end try` : ""}
                else if "${n}" = "main_bottom" then
                    ${o.tl ? `try 
 set p to first application process whose name contains "${o.tl}" 
 set position of front window of p to {0, 25} 
 set size of front window of p to {halfW, halfH - 12} 
 end try` : ""}
                    ${o.tr ? `try 
 set p to first application process whose name contains "${o.tr}" 
 set position of front window of p to {halfW, 25} 
 set size of front window of p to {halfW, halfH - 12} 
 end try` : ""}
                    ${o.bl ? `try 
 set p to first application process whose name contains "${o.bl}" 
 set position of front window of p to {0, 25 + halfH - 12} 
 set size of front window of p to {screenW, halfH - 12} 
 end try` : ""}
                else
                    ${o.tl ? `try 
 set p to first application process whose name contains "${o.tl}" 
 set position of front window of p to {0, 25} 
 set size of front window of p to {halfW, screenH - 25} 
 end try` : ""}
                    ${o.tr ? `try 
 set p to first application process whose name contains "${o.tr}" 
 set position of front window of p to {halfW, 25} 
 set size of front window of p to {halfW, halfH - 12} 
 end try` : ""}
                    ${o.br ? `try 
 set p to first application process whose name contains "${o.br}" 
 set position of front window of p to {halfW, 25 + halfH - 12} 
 set size of front window of p to {halfW, halfH - 12} 
 end try` : ""}
                end if
            else
                set frontApp to first application process whose frontmost is true
                set frontWin to front window of frontApp
                if "${t}" = "snap_left" then
                    set position of frontWin to {0, 25}
                    set size of frontWin to {halfW, screenH - 25}
                else if "${t}" = "snap_right" then
                    set position of frontWin to {halfW, 25}
                    set size of frontWin to {halfW, screenH - 25}
                else if "${t}" = "maximize" then
                    set position of frontWin to {0, 25}
                    set size of frontWin to {screenW, screenH - 25}
                end if
            end if
        end tell
        `;
        try {
          await te(`osascript -e '${r.replace(/'/g, "'\\''")}'`);
        } catch {
          throw new Error("Failed to arrange windows (requires Accessibility permissions on macOS)");
        }
      } else if (process.platform === "win32") {
        const r = `
        Add-Type -AssemblyName System.Windows.Forms
        $code = @"
        using System; using System.Runtime.InteropServices;
        public class W {
          [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
          [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr h, int x, int y, int w, int h, bool r);
        }
        "@
        Add-Type -TypeDefinition $code
        $area = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
        $halfW = [math]::Floor($area.Width / 2)
        $halfH = [math]::Floor($area.Height / 2)
        $layout = "${t}"
        $ori = "${n}"

        function MoveApp($n, $x, $y, $w, $h) {
            if (-not $n) { return }
            $p = Get-Process | Where-Object { $_.MainWindowTitle -match $n -or $_.Name -match $n } | Select-Object -First 1
            if ($p -and $p.MainWindowHandle) { [W]::MoveWindow($p.MainWindowHandle, $x, $y, $w, $h, $true) }
        }

        if ($layout -eq "quad") {
            MoveApp "${o.tl}" $area.Left $area.Top $halfW $halfH
            MoveApp "${o.tr}" ($area.Left + $halfW) $area.Top $halfW $halfH
            MoveApp "${o.bl}" $area.Left ($area.Top + $halfH) $halfW $halfH
            MoveApp "${o.br}" ($area.Left + $halfW) ($area.Top + $halfH) $halfW $halfH
        } elseif ($layout -eq "split_specific") {
            if ($ori -eq "horizontal") {
                MoveApp "${o.tl}" $area.Left $area.Top $area.Width $halfH
                MoveApp "${o.tr}" $area.Left ($area.Top + $halfH) $area.Width $halfH
            } else {
                MoveApp "${o.tl}" $area.Left $area.Top $halfW $area.Height
                MoveApp "${o.tr}" ($area.Left + $halfW) $area.Top $halfW $area.Height
            }
        } elseif ($layout -eq "tri") {
            if ($ori -eq "main_right") {
                MoveApp "${o.tl}" $area.Left $area.Top $halfW $halfH
                MoveApp "${o.bl}" $area.Left ($area.Top + $halfH) $halfW $halfH
                MoveApp "${o.tr}" ($area.Left + $halfW) $area.Top $halfW $area.Height
            } elseif ($ori -eq "main_top") {
                MoveApp "${o.tl}" $area.Left $area.Top $area.Width $halfH
                MoveApp "${o.bl}" $area.Left ($area.Top + $halfH) $halfW $halfH
                MoveApp "${o.br}" ($area.Left + $halfW) ($area.Top + $halfH) $halfW $halfH
            } elseif ($ori -eq "main_bottom") {
                MoveApp "${o.tl}" $area.Left $area.Top $halfW $halfH
                MoveApp "${o.tr}" ($area.Left + $halfW) $area.Top $halfW $halfH
                MoveApp "${o.bl}" $area.Left ($area.Top + $halfH) $area.Width $halfH
            } else {
                MoveApp "${o.tl}" $area.Left $area.Top $halfW $area.Height
                MoveApp "${o.tr}" ($area.Left + $halfW) $area.Top $halfW $halfH
                MoveApp "${o.br}" ($area.Left + $halfW) ($area.Top + $halfH) $halfW $halfH
            }
        } else {
            $hwnd = [W]::GetForegroundWindow()
            if ($layout -eq "snap_left") { [W]::MoveWindow($hwnd, $area.Left, $area.Top, $halfW, $area.Height, $true) }
            if ($layout -eq "snap_right") { [W]::MoveWindow($hwnd, $area.Left + $halfW, $area.Top, $halfW, $area.Height, $true) }
            if ($layout -eq "maximize") { [W]::MoveWindow($hwnd, $area.Left, $area.Top, $area.Width, $area.Height, $true) }
        }
        `;
        await te(`powershell -Command "${r.replace(/"/g, '\\"')}"`, { windowsHide: !0 });
      } else
        throw new Error("Window arrangement is not supported on this OS.");
      return;
    }
    case "run_script": {
      const t = new AbortController(), { signal: n } = t, o = setTimeout(() => {
        t.abort();
      }, 12e4);
      try {
        const r = oe(e.value, { windowsHide: !0 });
        n.addEventListener("abort", () => {
          r.pid && (process.platform === "win32" ? oe(`taskkill /pid ${r.pid} /t /f`, { windowsHide: !0 }) : process.kill(-r.pid, "SIGKILL"));
        }), await new Promise((s, i) => {
          r.on("exit", (c) => {
            c === 0 ? s(void 0) : i(new Error(`Command exited with code ${c}`));
          }), r.on("error", i);
        });
      } catch (r) {
        throw n.aborted ? new Error("Script execution timed out (120s) and was terminated.") : r;
      } finally {
        clearTimeout(o);
      }
      return;
    }
    default:
      throw new Error(`Unknown action type: ${e.type}`);
  }
}
async function Rt(e) {
  const t = [];
  if (me.has(e.id))
    return [{ actionId: "system", success: !1, error: "Shortcut is already running." }];
  me.add(e.id);
  try {
    for (let n = 0; n < e.actions.length; n++) {
      _ == null || _.webContents.send("shortcut-progress", { shortcutId: e.id, stepIndex: n });
      const o = e.actions[n];
      try {
        await pi(o), t.push({ actionId: o.id, success: !0 });
      } catch (r) {
        t.push({ actionId: o.id, success: !1, error: r instanceof Error ? r.message : String(r) });
      }
    }
  } finally {
    me.delete(e.id);
  }
  return _ == null || _.webContents.send("shortcut-complete", { shortcutId: e.id, results: t }), t;
}
X.handle("execute-shortcut", async (e, t) => {
  try {
    const n = Ct.parse(t);
    return Rt(n);
  } catch (n) {
    return [{ actionId: "system", success: !1, error: n.message || "Invalid shortcut data" }];
  }
});
X.handle("check-path-exists", async (e, t) => {
  try {
    return ge.statSync(t), !0;
  } catch {
    return !1;
  }
});
function hi(e) {
  return e.actions.some((t) => t.type === "run_script" || t.type === "launch_app");
}
const tt = /* @__PURE__ */ new Map(), nt = /* @__PURE__ */ new Map(), mi = {
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  " ": "Space",
  Escape: "Esc",
  Delete: "Delete",
  Backspace: "Backspace",
  Enter: "Return",
  Tab: "Tab"
};
function _i(e) {
  const t = e.split("+").map((r) => r.trim()).filter(Boolean), n = [];
  let o = null;
  for (const r of t)
    r === "Ctrl" ? n.push("CommandOrControl") : r === "Alt" ? n.push("Alt") : r === "Shift" ? n.push("Shift") : r === "Win" ? n.push("Super") : o = mi[r] ?? r;
  return o ? (n.push(o), n.join("+")) : null;
}
function gi(e) {
  _e.unregisterAll(), tt.clear(), nt.clear();
  for (const t of e) {
    if (!t.hotkey || t.hotkey === "Listening...") continue;
    nt.set(t.id, t);
    const n = _i(t.hotkey);
    if (n)
      try {
        _e.register(n, () => {
          hi(t) ? _ == null || _.webContents.send("hotkey-needs-confirm", t.id) : (_ == null || _.webContents.send("hotkey-triggered", t.id), Rt(t));
        }) ? tt.set(n, t.id) : _ == null || _.webContents.send("hotkey-register-failed", { shortcutId: t.id, hotkey: t.hotkey });
      } catch {
        _ == null || _.webContents.send("hotkey-register-failed", { shortcutId: t.id, hotkey: t.hotkey });
      }
  }
}
X.on("sync-hotkeys", (e, t) => {
  try {
    const n = Te(Ct).max(500).parse(t);
    gi(n);
  } catch (n) {
    console.error("Failed to sync hotkeys due to invalid payload:", n);
  }
});
R.on("will-quit", () => {
  _e.unregisterAll();
});
R.on("window-all-closed", () => {
  process.platform !== "darwin" && (R.quit(), _ = null);
});
R.on("activate", () => {
  rt.getAllWindows().length === 0 && jt();
});
R.whenReady().then(() => {
  jt(), ai();
});
export {
  ki as MAIN_DIST,
  Pt as RENDERER_DIST,
  ve as VITE_DEV_SERVER_URL
};
