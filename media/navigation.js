(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.WorkNotesNavigation = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  return {
    plan(action, dirty) {
      return dirty
        ? { saveFirst: true, pendingAction: action }
        : { saveFirst: false, dispatchAction: action };
    }
  };
});
