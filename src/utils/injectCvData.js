async function injectCvData(page, cvData) {
  await page.evaluate((data) => {
    const getByPath = (obj, pathStr) => {
      if (pathStr === '.') return obj;
      if (!obj || !pathStr) return undefined;
      return pathStr.split('.').reduce((acc, key) => {
        if (acc == null) return undefined;
        const idx = Number(key);
        if (Number.isInteger(idx) && String(idx) === key) return acc[idx];
        return acc[key];
      }, obj);
    };

    const resolveValue = (scope, pathStr) => {
      if (!pathStr) return undefined;
      if (pathStr === '$index') return scope.index;
      if (pathStr === '$item') return scope.item;
      if (pathStr === '.') return scope.item;
      if (pathStr.startsWith('$root.')) return getByPath(scope.root, pathStr.slice('$root.'.length));
      return getByPath(scope.item, pathStr);
    };

    const isInRenderedSection = (el) => {
      if (!el || !el.closest) return false;
      return Boolean(el.closest('[data-cv-rendered-section="true"]'));
    };

    // First, process data-cv-section-data containers (inject section data)
    document.querySelectorAll('[data-cv-section-data]').forEach((container) => {
      try {
        const sectionData = JSON.parse(container.getAttribute('data-cv-section-data').replace(/&quot;/g, '"'));
        const sectionScope = { root: data, item: sectionData, index: 0 };
        
        // Check if element is inside a repeat template (should be skipped at container level)
        const isInsideRepeat = (el, container) => {
          let parent = el.parentElement;
          while (parent && parent !== container) {
            if (parent.hasAttribute && parent.hasAttribute('data-cv-repeat')) return true;
            parent = parent.parentElement;
          }
          return false;
        };

        // Apply bindings to elements, optionally skipping those inside repeats
        const applyBindingsToNode = (node, scope, skipInsideRepeats = false, container = null) => {
          node.querySelectorAll('[data-cv-text]').forEach((el) => {
            if (skipInsideRepeats && isInsideRepeat(el, container)) return;
            const p = el.getAttribute('data-cv-text');
            const v = resolveValue(scope, p);
            if (typeof v === 'string' || typeof v === 'number') {
              el.textContent = String(v);
            }
          });

          node.querySelectorAll('[data-cv-href]').forEach((el) => {
            if (skipInsideRepeats && isInsideRepeat(el, container)) return;
            const p = el.getAttribute('data-cv-href');
            const v = resolveValue(scope, p);
            if (typeof v === 'string') {
              el.setAttribute('href', v);
            }
          });

          node.querySelectorAll('[data-cv-src]').forEach((el) => {
            if (skipInsideRepeats && isInsideRepeat(el, container)) return;
            const p = el.getAttribute('data-cv-src');
            const v = resolveValue(scope, p);
            if (typeof v === 'string') {
              el.setAttribute('src', v);
            }
          });

          node.querySelectorAll('[data-cv-date-range]').forEach((el) => {
            if (skipInsideRepeats && isInsideRepeat(el, container)) return;
            const p = el.getAttribute('data-cv-date-range');
            const entry = resolveValue(scope, p);
            if (!entry || typeof entry !== 'object') return;
            const start = entry.startDate;
            const end = entry.endDate || 'Present';
            if (start) {
              el.textContent = `${start} - ${end}`;
            }
          });

          node.querySelectorAll('[data-cv-circles]').forEach((el) => {
            if (skipInsideRepeats && isInsideRepeat(el, container)) return;
            const levelPath = el.getAttribute('data-cv-circles');
            const maxPath = el.getAttribute('data-cv-circles-max');
            const level = Number(resolveValue(scope, levelPath) || 0);
            const maxLevel = maxPath ? Number(resolveValue(scope, maxPath) || 0) : 0;

            const circles = el.querySelectorAll('.circle');
            const max = maxLevel > 0 ? Math.min(maxLevel, circles.length) : circles.length;

            circles.forEach((circle, i) => {
              if (i < max && i < level) {
                circle.classList.add('filled');
                circle.classList.remove('empty');
              } else {
                circle.classList.add('empty');
                circle.classList.remove('filled');
              }
            });
          });

          node.querySelectorAll('[data-cv-class]').forEach((el) => {
            if (skipInsideRepeats && isInsideRepeat(el, container)) return;
            const p = el.getAttribute('data-cv-class');
            const v = resolveValue(scope, p);
            if (typeof v === 'string') {
              el.className = v;
            }
          });
        };

        // Process this container's repeats and bindings with section scope
        const processNode = (node, scope, isTopLevel = false) => {
          // Handle repeats within this section
          const repeats = Array.from(node.querySelectorAll('[data-cv-repeat]'));
          repeats.forEach((repeatEl) => {
            const repeatPath = repeatEl.getAttribute('data-cv-repeat');
            const arr = resolveValue(scope, repeatPath);
            if (!Array.isArray(arr)) return;

            const template = Array.from(repeatEl.children).find((c) => c.tagName === 'TEMPLATE');
            if (!template) return;

            Array.from(repeatEl.childNodes).forEach((n) => {
              if (n !== template) repeatEl.removeChild(n);
            });

            arr.forEach((item, idx) => {
              const fragment = template.content.cloneNode(true);
              const itemScope = { root: scope.root, item, index: idx };
              processNode(fragment, itemScope, false);
              repeatEl.appendChild(fragment);
            });
          });

          // Apply bindings - at top level, skip elements inside repeats (they were handled recursively)
          applyBindingsToNode(node, scope, isTopLevel, isTopLevel ? container : null);
        };

        processNode(container, sectionScope, true);
        container.setAttribute('data-cv-rendered-section', 'true');
        container.removeAttribute('data-cv-section-data');
      } catch (e) {
        console.error('Error processing section data:', e);
      }
    });

    const applyBindings = (rootNode, scope) => {
      rootNode.querySelectorAll('[data-cv-text]').forEach((el) => {
        if (isInRenderedSection(el)) return;
        const p = el.getAttribute('data-cv-text');
        const v = resolveValue(scope, p);
        if (typeof v === 'string' || typeof v === 'number') {
          el.textContent = String(v);
        }
      });

      rootNode.querySelectorAll('[data-cv-href]').forEach((el) => {
        if (isInRenderedSection(el)) return;
        const p = el.getAttribute('data-cv-href');
        const v = resolveValue(scope, p);
        if (typeof v === 'string') {
          el.setAttribute('href', v);
        }
      });

      rootNode.querySelectorAll('[data-cv-date-range]').forEach((el) => {
        if (isInRenderedSection(el)) return;
        const p = el.getAttribute('data-cv-date-range');
        const entry = resolveValue(scope, p);
        if (!entry || typeof entry !== 'object') return;
        const start = entry.startDate;
        const end = entry.endDate || 'Present';
        if (start) {
          el.textContent = `${start} - ${end}`;
        }
      });

      rootNode.querySelectorAll('[data-cv-circles]').forEach((el) => {
        if (isInRenderedSection(el)) return;
        const levelPath = el.getAttribute('data-cv-circles');
        const maxPath = el.getAttribute('data-cv-circles-max');
        const level = Number(resolveValue(scope, levelPath) || 0);
        const maxLevel = maxPath ? Number(resolveValue(scope, maxPath) || 0) : 0;

        const circles = el.querySelectorAll('.circle');
        const max = maxLevel > 0 ? Math.min(maxLevel, circles.length) : circles.length;

        circles.forEach((circle, i) => {
          if (i < max && i < level) {
            circle.classList.add('filled');
            circle.classList.remove('empty');
          } else {
            circle.classList.add('empty');
            circle.classList.remove('filled');
          }
        });
      });
    };

    const renderRepeats = (rootNode, scope) => {
      const repeats = Array.from(rootNode.querySelectorAll('[data-cv-repeat]'));

      repeats.forEach((repeatEl) => {
        if (isInRenderedSection(repeatEl)) return;
        const repeatPath = repeatEl.getAttribute('data-cv-repeat');
        const arr = resolveValue(scope, repeatPath);
        if (!Array.isArray(arr)) return;

        const template = Array.from(repeatEl.children).find((c) => c.tagName === 'TEMPLATE');
        if (!template) return;

        Array.from(repeatEl.childNodes).forEach((n) => {
          if (n !== template) repeatEl.removeChild(n);
        });

        arr.forEach((item, idx) => {
          const fragment = template.content.cloneNode(true);
          const itemScope = { root: scope.root, item, index: idx };

          renderRepeats(fragment, itemScope);
          applyBindings(fragment, itemScope);

          repeatEl.appendChild(fragment);
        });
      });
    };

    const rootScope = { root: data, item: data, index: 0 };
    renderRepeats(document, rootScope);
    applyBindings(document, rootScope);

    // Backwards compatibility for older language markup (data-cv-language-index)
    document.querySelectorAll('tr[data-cv-language-index]').forEach((tr) => {
      const idx = Number(tr.getAttribute('data-cv-language-index'));
      const lang = data && data.languages ? data.languages[idx] : null;
      if (!lang) return;

      const nameEl = tr.querySelector('[data-cv-language-name]');
      if (nameEl && typeof lang.name === 'string') {
        nameEl.textContent = lang.name;
      }

      const circles = tr.querySelectorAll('.circle');
      const level = Number(lang.level || 0);
      circles.forEach((circle, i) => {
        if (i < level) {
          circle.classList.add('filled');
          circle.classList.remove('empty');
        } else {
          circle.classList.add('empty');
          circle.classList.remove('filled');
        }
      });
    });
  }, cvData);
}

module.exports = { injectCvData };
