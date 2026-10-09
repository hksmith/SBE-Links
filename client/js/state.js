// Shared, mutable state of the admin app.
export const S = {
  list: [],        // accounts shown on the dashboard
  brand: '',       // brand logo URL
  cur: null,       // account being edited
  stats: null,     // analytics of the account being edited
  hist: [], hi: 0, // undo history (JSON snapshots) and current position
  tab: 'bio',      // editor tab: bio | design | stats
  open: null,      // id of the expanded block in the editor
  dirty: false,    // unsaved changes?
  timers: {},
  thTab: 'Classic', bsTab: 'Popular',
  upload: null,    // what the hidden file input is uploading for
};
