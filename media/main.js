(function () {
  const vscode = acquireVsCodeApi();
  const navigation = window.WorkNotesNavigation;
  const state = {
    notes: [], templates: [], selectedId: undefined, filter: 'all', filterValue: '', search: '',
    dirty: false, pendingAction: undefined
  };
  const $ = id => document.getElementById(id);

  function post(type, values = {}) { vscode.postMessage({ type, ...values }); }
  function dispatchAction(action) { post(action.type, action.values); }
  function selected() { return state.notes.find(note => note.id === state.selectedId); }
  function hasTasks(note) { return Boolean(note.hasTasks); }
  function text(value) { return String(value ?? '').toLocaleLowerCase(); }

  function visibleNotes() {
    return state.notes.filter(note => {
      if (state.search) {
        const haystack = text([note.title, note.notebook, note.body, ...note.tags].join('\n'));
        if (!haystack.includes(text(state.search))) return false;
      }
      switch (state.filter) {
        case 'inbox': return note.status === 'inbox';
        case 'daily': return note.notebook === 'Daily Notes';
        case 'tasks': return hasTasks(note);
        case 'archived': return note.status === 'archived';
        case 'notebook': return note.notebook === state.filterValue;
        case 'tag': return note.tags.includes(state.filterValue);
        default: return note.status !== 'archived';
      }
    });
  }

  function button(label, className, onClick) {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = className;
    element.textContent = label;
    element.addEventListener('click', onClick);
    return element;
  }

  function renderNavigation() {
    $('all-count').textContent = String(state.notes.filter(note => note.status !== 'archived').length);
    $('inbox-count').textContent = String(state.notes.filter(note => note.status === 'inbox').length);
    const notebooks = [...new Set(state.notes.map(note => note.notebook))].sort();
    $('notebooks').replaceChildren(...notebooks.map(name => button(name, 'nav-button', () => setFilter('notebook', name))));
    const tags = [...new Set(state.notes.flatMap(note => note.tags))].sort();
    $('tags').replaceChildren(...tags.map(name => button(`#${name}`, 'tag', () => setFilter('tag', name))));
  }

  function renderList() {
    const notes = visibleNotes();
    const children = notes.map(note => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = `note-card${note.id === state.selectedId ? ' selected' : ''}`;
      item.setAttribute('role', 'listitem');
      const title = document.createElement('strong');
      title.textContent = note.title || 'Untitled';
      const preview = document.createElement('span');
      preview.textContent = note.body.replace(/^#+\s*/gm, '').trim().split(/\r?\n/).find(Boolean) || 'Empty note';
      const meta = document.createElement('small');
      meta.textContent = `${note.notebook} · ${new Date(note.updated).toLocaleDateString()}`;
      item.append(title, preview, meta);
      item.addEventListener('click', () => requestNavigation('selectNote', { id: note.id }));
      return item;
    });
    if (!children.length) {
      const empty = document.createElement('p');
      empty.className = 'list-empty';
      empty.textContent = 'No notes match this view.';
      children.push(empty);
    }
    $('note-list').replaceChildren(...children);
  }

  function renderEditor() {
    const note = selected();
    $('empty').classList.toggle('hidden', Boolean(note));
    $('editor').classList.toggle('hidden', !note);
    if (!note) return;
    $('title').value = note.title;
    $('notebook').value = note.notebook;
    $('status').value = note.status;
    $('note-tags').value = note.tags.join(', ');
    $('body').value = note.body;
    $('note-path').textContent = note.relativePath || '';
    state.dirty = false;
    $('save-state').textContent = 'Markdown + YAML frontmatter';
  }

  function renderTemplates() {
    $('template-select').replaceChildren(...state.templates.map(template => {
      const option = document.createElement('option');
      option.value = template.id;
      option.textContent = template.title;
      return option;
    }));
  }

  function render() {
    renderNavigation();
    renderList();
    renderEditor();
    renderTemplates();
  }

  function setFilter(filter, value = '') {
    state.filter = filter;
    state.filterValue = value;
    document.querySelectorAll('[data-filter]').forEach(element => element.classList.toggle('active', element.dataset.filter === filter));
    renderList();
  }

  function toast(message) {
    $('toast').textContent = message;
    window.setTimeout(() => { if ($('toast').textContent === message) $('toast').textContent = ''; }, 2500);
  }

  function currentDraft() {
    const original = selected();
    if (!original) return undefined;
    return {
      ...original,
      title: $('title').value,
      notebook: $('notebook').value,
      status: $('status').value,
      tags: $('note-tags').value.split(',').map(tag => tag.trim()).filter(Boolean),
      body: $('body').value
    };
  }

  function saveCurrent() {
    const note = currentDraft();
    if (!note) return false;
    $('save-state').textContent = 'Saving…';
    post('saveNote', { note });
    return true;
  }

  function requestNavigation(type, values = {}) {
    const action = { type, values };
    const plan = navigation.plan(action, state.dirty);
    if (plan.saveFirst) {
      state.pendingAction = plan.pendingAction;
      if (!saveCurrent()) {
        state.pendingAction = undefined;
      }
      return;
    }
    dispatchAction(plan.dispatchAction);
  }

  window.addEventListener('message', event => {
    const message = event.data;
    if (message.type === 'snapshot') {
      state.notes = message.notes;
      state.templates = message.templates;
      state.selectedId = message.selectedId;
      render();
      if (message.warnings?.length) toast(`${message.warnings.length} note file(s) could not be loaded.`);
    } else if (message.type === 'unconfigured') {
      state.notes = [];
      state.selectedId = undefined;
      render();
    } else if (message.type === 'saved') {
      state.dirty = false;
      $('save-state').textContent = 'Saved';
      toast('Note saved');
      if (state.pendingAction) {
        const action = state.pendingAction;
        state.pendingAction = undefined;
        dispatchAction(action);
      }
    } else if (message.type === 'error') {
      state.pendingAction = undefined;
      state.dirty = true;
      $('save-state').textContent = 'Unsaved changes';
      toast(message.message);
    }
  });

  document.querySelectorAll('[data-filter]').forEach(element => element.addEventListener('click', () => setFilter(element.dataset.filter)));
  $('new-note').addEventListener('click', () => requestNavigation('newNote'));
  $('daily-note').addEventListener('click', () => requestNavigation('openDaily'));
  $('choose-root').addEventListener('click', () => requestNavigation('chooseRoot'));
  $('empty-choose-root').addEventListener('click', () => requestNavigation('chooseRoot'));
  $('capture-button').addEventListener('click', () => {
    const content = $('capture-input').value;
    if (content.trim()) {
      requestNavigation('quickCapture', { content });
      $('capture-input').value = '';
    }
  });
  $('search').addEventListener('input', event => { state.search = event.target.value; renderList(); });
  $('template-button').addEventListener('click', () => {
    const templateId = $('template-select').value;
    const title = window.prompt('Title for the new note');
    if (templateId && title?.trim()) requestNavigation('createFromTemplate', { templateId, title });
  });
  $('editor').addEventListener('submit', event => {
    event.preventDefault();
    state.pendingAction = undefined;
    saveCurrent();
  });
  ['title', 'notebook', 'status', 'note-tags', 'body'].forEach(id => {
    $(id).addEventListener('input', () => {
      state.dirty = true;
      $('save-state').textContent = 'Unsaved changes';
    });
  });
  post('ready');
})();
