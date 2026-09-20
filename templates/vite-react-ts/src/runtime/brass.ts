// Keep preview adoption behind one local boundary so rollback stays trivial.
export {
  Effect,
  Scope,
  makeRuntime,
  runPromise,
  withScopeAsync
} from "brass-runtime/next";

// Evidence-backed v2 gap: the template still needs structured parallelism.
export { zipPar } from "brass-runtime";
