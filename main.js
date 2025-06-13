    let input = null;
    let container = null;
    let suggestionBox = null;
    let lastEnterTime = 0;
    const MEMO_PREFIX = "memo-";
    const LAST_DATE_KEY = "last-open-date";
    const COMMENT_KEY = "comments";
    const DB_NAME = "thoughtsDB";
    const STORE_NAME = "thoughts";
    const BRANCH_STORE = "branches";
    const DB_VERSION = 2;
    const dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (e.oldVersion < 1) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
          db.createObjectStore(BRANCH_STORE, { keyPath: "id" });
        } else if (e.oldVersion === 1) {
          const oldStore = e.target.transaction.objectStore(STORE_NAME);
          const data = {};
          oldStore.openCursor().onsuccess = ev => {
            const cursor = ev.target.result;
            if (cursor) {
              data[cursor.key] = cursor.value;
              cursor.continue();
            } else {
              db.deleteObjectStore(STORE_NAME);
              const newStore = db.createObjectStore(STORE_NAME, { keyPath: "id" });
              db.createObjectStore(BRANCH_STORE, { keyPath: "id" });
              const commentsAll = JSON.parse(localStorage.getItem(COMMENT_KEY) || "{}");
              for (const [date, arr] of Object.entries(data)) {
                arr.forEach(({ id, text, continued }) => {
                  newStore.add({
                    id,
                    type: "seed",
                    text,
                    continued: !!continued,
                    callCount: 1,
                    appearedOn: [date],
                    comments: commentsAll[id] || [],
                    branchId: null,
                    treeId: null
                  });
                });
              }
            }
          };
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    let currentBubble = null;
    let currentId = null;

    function getToday() {
      return new Date().toISOString().slice(0, 10);
    }

    // ローカルタイムで「昨日」を取得
    function getYesterday() {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return d.toISOString().slice(0, 10);
    }
    let today = getToday();

    function getStorageKey(date = today) {
      return MEMO_PREFIX + date;
    }

    function getSeed(id) {
      return dbPromise.then(db => new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const req = tx.objectStore(STORE_NAME).get(id);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }));
    }

    function saveSeed(seed) {
      return dbPromise.then(db => new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put(seed);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }));
    }

    function deleteSeed(id) {
      return dbPromise.then(db => new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }));
    }

    function getSeedsByDate(date = today) {
      return dbPromise.then(db => new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const data = [];
        store.openCursor().onsuccess = e => {
          const cursor = e.target.result;
          if (cursor) {
            const seed = cursor.value;
            if (seed.appearedOn && seed.appearedOn.includes(date)) {
              data.push(seed);
            }
            cursor.continue();
          } else {
            resolve(data);
          }
        };
        tx.onerror = () => reject(tx.error);
      }));
    }

    function getAllSeeds() {
      return dbPromise.then(db => new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const data = [];
        store.openCursor().onsuccess = e => {
          const cursor = e.target.result;
          if (cursor) {
            data.push(cursor.value);
            cursor.continue();
          } else {
            resolve(data);
          }
        };
        tx.onerror = () => reject(tx.error);
      }));
    }

    function getAllBranches() {
      return dbPromise.then(db => new Promise((resolve, reject) => {
        if (!db.objectStoreNames.contains(BRANCH_STORE)) {
          resolve([]);
          return;
        }
        const tx = db.transaction(BRANCH_STORE, "readonly");
        const store = tx.objectStore(BRANCH_STORE);
        const data = [];
        store.openCursor().onsuccess = e => {
          const cursor = e.target.result;
          if (cursor) {
            data.push(cursor.value);
            cursor.continue();
          } else {
            resolve(data);
          }
        };
        tx.onerror = () => reject(tx.error);
      }));
    }

    function getBranch(id) {
      return dbPromise.then(db => new Promise((resolve, reject) => {
        if (!db.objectStoreNames.contains(BRANCH_STORE)) {
          resolve(null);
          return;
        }
        const tx = db.transaction(BRANCH_STORE, "readonly");
        const req = tx.objectStore(BRANCH_STORE).get(id);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }));
    }

    function saveBranch(branch) {
      return dbPromise.then(db => new Promise((resolve, reject) => {
        const tx = db.transaction(BRANCH_STORE, "readwrite");
        tx.objectStore(BRANCH_STORE).put(branch);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }));
    }

    async function searchThoughts(query) {
      const q = query.toLowerCase();
      const all = await getAllSeeds();
      const result = [];
      all.forEach(seed => {
        if (seed.text.toLowerCase().includes(q)) {
          const date = seed.appearedOn[seed.appearedOn.length - 1] || "";
          result.push({ id: seed.id, text: seed.text, date });
        }
      });
      result.sort((a, b) => b.date.localeCompare(a.date));
      return result.slice(0, 5);
    }

    function renderSuggestions(list, query) {
      suggestionBox.innerHTML = "";
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const reg = new RegExp(escaped, "gi");
      list.forEach(item => {
        const div = document.createElement("div");
        div.className = "suggestion";
        const highlighted = item.text.replace(reg, m => `<mark>${m}</mark>`);
        div.innerHTML = `<small>${item.date}</small> ${highlighted}`;
        div.onclick = () => {
          addBubble(item.text, false, item.id);
          suggestionBox.innerHTML = "";
        };
        suggestionBox.appendChild(div);
      });
    }

    async function migrateFromLocalStorage() {
      const keys = Object.keys(localStorage).filter(k => k.startsWith(MEMO_PREFIX));
      const commentsAll = JSON.parse(localStorage.getItem(COMMENT_KEY) || "{}");
      for (const key of keys) {
        const date = key.slice(MEMO_PREFIX.length);
        const value = JSON.parse(localStorage.getItem(key) || "[]");
        for (const { id, text, continued } of value) {
          const seed = {
            id,
            type: "seed",
            text,
            continued: !!continued,
            callCount: 1,
            appearedOn: [date],
            comments: commentsAll[id] || [],
            branchId: null,
            treeId: null
          };
          await saveSeed(seed);
        }
        localStorage.removeItem(key);
      }
      localStorage.removeItem(COMMENT_KEY);
    }

    // 読み込み
    async function loadBubbles(date = today) {
      const [data, branches] = await Promise.all([
        getSeedsByDate(date),
        getAllBranches()
      ]);
      const map = {};
      branches.forEach(b => { map[b.id] = b.name; });
      data.forEach(({ id, text, continued, branchId }) => {
        createBubble(id, text, continued, map[branchId]);
      });
    }

    // 吹き出し生成
    function createBubble(id, text, continued = false, branchName = null) {
      const div = document.createElement("div");
      div.className = "bubble";
      div.dataset.id = id;
      div.dataset.continued = continued;
      div.dataset.text = text;

      const textSpan = document.createElement("span");
      textSpan.className = "bubble-text";
      textSpan.textContent = text;
      div.appendChild(textSpan);
      if (branchName) {
        const tag = document.createElement("span");
        tag.className = "branch-tag";
        tag.textContent = branchName;
        div.appendChild(tag);
      }

      div.onclick = function () {
        openModal(this);
      };

      container.appendChild(div);
    }

    // 吹き出し追加
    async function addBubble(text = null, continued = false, reuseId = null) {
      const inputText = text !== null ? text : input.value.trim();
      if (inputText === "") return;
      const id = reuseId || "id-" + Date.now() + Math.random().toString(36).slice(2, 5);
      let branchName = null;

      if (reuseId) {
        const seed = await getSeed(reuseId);
        if (seed) {
          seed.callCount = (seed.callCount || 0) + 1;
          if (!seed.appearedOn.includes(today)) seed.appearedOn.push(today);
          seed.continued = continued;
          await saveSeed(seed);
          if (seed.branchId) {
            const br = await getBranch(seed.branchId);
            branchName = br ? br.name : null;
          }
        }
      } else {
        const seed = {
          id,
          type: "seed",
          text: inputText,
          continued,
          callCount: 1,
          appearedOn: [today],
          comments: [],
          branchId: null,
          treeId: null
        };
        await saveSeed(seed);
      }

      createBubble(id, inputText, continued, branchName);
      if (text === null) {
        input.value = "";
        input.focus();
        suggestionBox.innerHTML = "";
      }
    }

    if (location.pathname.endsWith("Message.html")) {
      input = document.getElementById("textInput");
      container = document.getElementById("bubbleContainer");
      suggestionBox = document.getElementById("suggestions");

      input.addEventListener("input", async function () {
        const query = input.value.trim();
        if (!query) {
          suggestionBox.innerHTML = "";
          return;
        }
      const matches = await searchThoughts(query);
      if (matches.length) {
        renderSuggestions(matches, query);
      } else {
        suggestionBox.innerHTML = "";
      }
    });

    // Enter2回で送信
      input.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          const now = Date.now();
          if (now - lastEnterTime < 500) {
            event.preventDefault();
            addBubble();
          }
          lastEnterTime = now;
        }
      });

      // 日付変更処理
      async function startNewDay(prevDate) {
        container.innerHTML = "";
        input.value = "";
        await loadBubbles();
        const yData = await getSeedsByDate(prevDate);
        if (yData.length) showCarryover(yData);
        localStorage.setItem(LAST_DATE_KEY, today);
      }

      async function checkNewDay() {
        const now = getToday();
        if (now !== today) {
          const prev = today;
          today = now;
          await startNewDay(prev);
        }
      }

      // 初期化
      (async function () {
        await migrateFromLocalStorage();
        const lastOpen = localStorage.getItem(LAST_DATE_KEY);
        if (!lastOpen || lastOpen !== today) {
          await startNewDay(lastOpen || getYesterday());
        } else {
          localStorage.setItem(LAST_DATE_KEY, today);
          await loadBubbles();
        }
        setInterval(checkNewDay, 60000);
        window.addEventListener("focus", checkNewDay);
      })();
    }

    // モーダル関連
    function openModal(bubble) {
      currentBubble = bubble;
      currentId = bubble.dataset.id;
      document.getElementById("modalText").textContent = bubble.dataset.text;
      document.getElementById("commentInput").value = "";
      renderComments();
      document.getElementById("modal").style.display = "block";
    }

    function closeModal() {
      document.getElementById("modal").style.display = "none";
    }

    function editCurrentBubble() {
      const newText = prompt("新しい内容を入力してください", currentBubble.dataset.text);
      if (newText !== null && newText.trim() !== "") {
        const span = currentBubble.querySelector(".bubble-text");
        if (span) span.textContent = newText.trim();
        currentBubble.dataset.text = newText.trim();
        document.getElementById("modalText").textContent = newText.trim();
        getSeed(currentId).then(seed => {
          if (seed) {
            seed.text = newText.trim();
            saveSeed(seed);
          }
        });
      }
    }

    function deleteCurrentBubble() {
      if (confirm("本当に削除しますか？")) {
        currentBubble.remove();
        deleteSeed(currentId);
        closeModal();
      }
    }

    function submitComment() {
      const commentText = document.getElementById("commentInput").value.trim();
      if (commentText === "") return;
      getSeed(currentId).then(seed => {
        if (!seed) return;
        seed.comments = seed.comments || [];
        seed.comments.push(commentText);
        saveSeed(seed).then(() => {
          document.getElementById("commentInput").value = "";
          renderComments();
        });
      });
    }

    function renderComments() {
      const list = document.getElementById("commentList");
      list.innerHTML = "";
      getSeed(currentId).then(seed => {
        const comments = (seed && seed.comments) || [];

        comments.forEach((text, index) => {
          const div = document.createElement("div");
          div.innerHTML = `<span>${text}</span><button onclick="deleteComment(${index})">削除</button>`;
          list.appendChild(div);
        });
      });
    }

    function deleteComment(index) {
      getSeed(currentId).then(seed => {
        if (!seed) return;
        seed.comments.splice(index, 1);
        saveSeed(seed).then(renderComments);
      });
    }

    function showCarryover(list) {
      const area = document.getElementById("carryoverList");
      area.innerHTML = "";
      list.forEach(({ id, text }) => {
        const label = document.createElement("label");
        const chk = document.createElement("input");
        chk.type = "checkbox";
        chk.dataset.id = id;
        chk.dataset.text = text;
        label.appendChild(chk);
        label.appendChild(document.createTextNode(" " + text));
        area.appendChild(label);
      });
      document.getElementById("carryoverModal").style.display = "block";
    }

    function confirmCarryover() {
      document.querySelectorAll("#carryoverList input:checked").forEach(el => {
        addBubble(el.dataset.text, true, el.dataset.id);
      });
      document.getElementById("carryoverModal").style.display = "none";
    }

    async function exportData() {
      const seeds = await getAllSeeds();
      const branches = await getAllBranches();
      const blob = new Blob([
        JSON.stringify({ seeds, branches }, null, 2)
      ], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "thoughts.json";
      a.click();
      URL.revokeObjectURL(url);
    }

    function importData(file) {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const data = JSON.parse(reader.result);
          if (data.seeds) {
            for (const seed of data.seeds) {
              await saveSeed(seed);
            }
          }
          if (data.branches) {
            for (const br of data.branches) {
              await saveBranch(br);
            }
          }
          location.reload();
        } catch (e) {
          alert("Import failed: " + e.message);
        }
      };
      reader.readAsText(file);
    }


    // Branch editor page
    if (location.pathname.endsWith("branch.html")) {
      async function renderSeeds() {
        await migrateFromLocalStorage();
        const [list, branches] = await Promise.all([
          getAllSeeds(),
          getAllBranches()
        ]);
        const map = {};
        branches.forEach(b => b.seedIds.forEach(id => { map[id] = b.name; }));
        list.sort((a, b) => {
          const ad = a.appearedOn[a.appearedOn.length - 1] || "";
          const bd = b.appearedOn[b.appearedOn.length - 1] || "";
          return bd.localeCompare(ad);
        });
        const container = document.getElementById("seedList");
        container.innerHTML = "";
        list.forEach(seed => {
          const label = document.createElement("label");
          const chk = document.createElement("input");
          chk.type = "checkbox";
          chk.value = seed.id;
          chk.onchange = updateSelected;
          if (seed.branchId) chk.disabled = true;
          label.appendChild(chk);
          const d = seed.appearedOn[seed.appearedOn.length - 1] || "";
          let text = ` [${d}] ${seed.text}`;
          if (seed.branchId && map[seed.id]) text += ` (in ${map[seed.id]})`;
          label.appendChild(document.createTextNode(text));
          container.appendChild(label);
        });
      }

      function updateSelected() {
        const selected = Array.from(document.querySelectorAll('#seedList input:checked'));
        const area = document.getElementById('selectedSeeds');
        area.innerHTML = selected.map(el => el.parentNode.textContent).join('<br>');
      }

      async function renderBranches() {
        const container = document.getElementById('branchList');
        const branches = await getAllBranches();
        branches.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
        container.innerHTML = '';
        branches.forEach(br => {
          const div = document.createElement('div');
          div.className = 'branch-item';
          const header = document.createElement('div');
          const link = document.createElement('span');
          link.style.cursor = 'pointer';
          link.textContent = br.name;
          link.onclick = () => toggleBranchDetail(br.id);
          header.appendChild(link);
          header.appendChild(document.createTextNode(` (${br.seedIds.length}) - ${br.createdAt.slice(0,10)}`));
          div.appendChild(header);
          const inner = document.createElement('div');
          inner.className = 'seeds';
          inner.id = 'detail-' + br.id;
          inner.style.display = 'none';
          div.appendChild(inner);
          container.appendChild(div);
        });
      }

      async function toggleBranchDetail(branchId) {
        const area = document.getElementById('detail-' + branchId);
        if (!area) return;
        if (area.style.display === 'block') {
          area.style.display = 'none';
          return;
        }
        const branch = await getBranch(branchId);
        area.innerHTML = '';
        for (const id of branch.seedIds) {
          const seed = await getSeed(id);
          if (!seed) continue;
          const div = document.createElement('div');
          div.className = 'seed';
          const span = document.createElement('span');
          span.textContent = `${seed.text} (x${seed.callCount || 0})`;
          div.appendChild(span);
          if (seed.comments && seed.comments.length) {
            const c = document.createElement('div');
            c.style.fontSize = '12px';
            c.textContent = 'Comments: ' + seed.comments.join(', ');
            div.appendChild(c);
          }
          const btn = document.createElement('button');
          btn.textContent = 'Remove';
          btn.onclick = () => removeSeedFromBranch(branchId, id);
          div.appendChild(btn);
          area.appendChild(div);
        }
        area.style.display = 'block';
      }

      async function removeSeedFromBranch(branchId, seedId) {
        const branch = await getBranch(branchId);
        if (!branch) return;
        branch.seedIds = branch.seedIds.filter(id => id !== seedId);
        await saveBranch(branch);
        const seed = await getSeed(seedId);
        if (seed) {
          seed.branchId = null;
          await saveSeed(seed);
        }
        await renderBranches();
        await renderSeeds();
      }

      async function createBranch() {
        const name = document.getElementById('branchName').value.trim();
        const ids = Array.from(document.querySelectorAll('#seedList input:checked')).map(el => el.value);
        if (!name || ids.length === 0) {
          alert('Enter a name and select seeds');
          return;
        }
        const branchId = 'branch-' + Date.now() + Math.random().toString(36).slice(2,5);
        const branch = { id: branchId, name, seedIds: ids, createdAt: new Date().toISOString() };
        await saveBranch(branch);
        for (const id of ids) {
          const seed = await getSeed(id);
          if (seed) {
            seed.branchId = branchId;
            await saveSeed(seed);
          }
        }
        document.getElementById('confirm').style.display = 'block';
        document.getElementById('branchName').value = '';
        await renderBranches();
        await renderSeeds();
      }

      document.getElementById('createBranch').onclick = createBranch;
      document.addEventListener('DOMContentLoaded', () => {
        renderSeeds();
        renderBranches();
      });
    }

    // History page
    if (location.pathname.endsWith("history.html")) {
      async function renderHistory() {
        await migrateFromLocalStorage();
        const historyDiv = document.getElementById("history");
        historyDiv.innerHTML = "";
        const seeds = await getAllSeeds();
        const map = {};
        seeds.forEach(seed => {
          seed.appearedOn.forEach(d => {
            if (!map[d]) map[d] = [];
            map[d].push(seed);
          });
        });
        Object.keys(map)
          .sort()
          .reverse()
          .forEach(date => {
            const items = map[date];
            if (!items.length) return;
            const header = document.createElement("div");
            header.className = "dayHeader";
            header.textContent = date;
            historyDiv.appendChild(header);
            items.forEach(({ text }) => {
              const div = document.createElement("div");
              div.className = "historyBubble";
              div.textContent = text;
              historyDiv.appendChild(div);
            });
          });
      }

      document.addEventListener("DOMContentLoaded", renderHistory);
    }
