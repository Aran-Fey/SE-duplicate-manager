// ==UserScript==
// @name         StackExchange duplicate manager
// @description  Lets you mark questions as commonly used duplicate targets, and search through your collection of duplicate targets from within the close question dialog
// @version      1.3
// @author       Paul Pinterits
// @include      *://*.stackexchange.com/questions/*
// @include      *://meta.serverfault.com/questions/*
// @include      *://meta.stackoverflow.com/questions/*
// @include      *://meta.superuser.com/questions/*
// @include      *://serverfault.com/questions/*
// @include      *://stackoverflow.com/questions/*
// @include      *://superuser.com/questions/*
// @include      *://*.stackexchange.com/users/*
// @include      *://meta.serverfault.com/users/*
// @include      *://meta.stackoverflow.com/users/*
// @include      *://meta.superuser.com/users/*
// @include      *://serverfault.com/users/*
// @include      *://stackoverflow.com/users/*
// @include      *://superuser.com/users/*
// @exclude      *://*/questions/tagged/*
// @exclude      *://*/questions/ask
// @namespace    Aran-Fey
// @require      https://github.com/Aran-Fey/userscript-lib/raw/60f9b285091e93d3879c7e94233192b7ab370821/userscript_lib.js
// @require      https://github.com/Aran-Fey/SE-userscript-lib/raw/bf77f40b25d7fa88a6c3f474390c858446154ec2/SE_userscript_lib.js
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM.setValue
// @grant        GM.getValue
// @updateURL    https://github.com/Aran-Fey/SE-duplicate-manager/raw/master/SE_duplicate_manager.meta.js
// @downloadURL  https://github.com/Aran-Fey/SE-duplicate-manager/raw/master/SE_duplicate_manager.user.js
// ==/UserScript==


(function(){
    const ICON_CODE = '<path d="M 48.779,9.635 42.77,7.23 40.366,1.22 37.22,4.365 C 33.521,2.17 29.318,1 25,1 11.767,1 1,11.767 1,25 1,38.233 11.767,49 25,49 38.233,49 49,38.233 49,25 49,20.682 47.83,16.479 45.635,12.78 Z M 41.23,8.77 45.22,10.366 42.758,12.827 38.77,11.23 37.174,7.241 39.635,4.779 Z M 47,25 C 47,37.131 37.131,47 25,47 12.869,47 3,37.131 3,25 3,12.869 12.869,3 25,3 c 3.788,0 7.485,0.971 10.767,2.818 l -0.941,0.941 2,5.001 -1.259,1.259 C 32.746,10.526 29.052,9 25,9 16.178,9 9,16.178 9,25 c 0,8.822 7.178,16 16,16 8.822,0 16,-7.178 16,-16 0,-4.052 -1.526,-7.746 -4.018,-10.568 l 1.259,-1.259 5.001,2 0.941,-0.941 C 46.029,17.515 47,21.212 47,25 Z m -16,0 c 0,3.309 -2.691,6 -6,6 -3.309,0 -6,-2.691 -6,-6 0,-3.309 2.691,-6 6,-6 1.294,0 2.49,0.416 3.471,1.115 l -2.959,2.959 C 25.347,23.031 25.178,23 25,23 c -1.104,0 -2,0.895 -2,2 0,1.105 0.896,2 2,2 1.104,0 2,-0.895 2,-2 0,-0.178 -0.031,-0.347 -0.074,-0.512 l 2.959,-2.959 C 30.584,22.51 31,23.706 31,25 Z M 29.898,18.688 C 28.542,17.634 26.846,17 25,17 c -4.411,0 -8,3.589 -8,8 0,4.411 3.589,8 8,8 4.411,0 8,-3.589 8,-8 0,-1.846 -0.634,-3.542 -1.688,-4.898 l 4.257,-4.257 C 37.7,18.303 39,21.499 39,25 39,32.72 32.72,39 25,39 17.28,39 11,32.72 11,25 c 0,-7.72 6.28,-14 14,-14 3.5,0 6.697,1.3 9.154,3.432 z" />';


    /* ===========
     * DUPLICATE TARGETS STORAGE
     * ===========
    */
    var ORIGINALS = null;
    function get_storage_key(){
        const hostname = document.location.hostname;
        const key = hostname.replace(/\./, '_') + '_duplicates';
        return key;
    }
    async function get_originals(reload){
        if (ORIGINALS !== null && reload !== true){
            return ORIGINALS;
        }
        
        const key = get_storage_key();
        const origs_json = await UserScript.getValue(key, '{}');
        ORIGINALS = JSON.parse(origs_json);
        return ORIGINALS;
    }
    async function get_originals_list(){
        const originals = await get_originals();
        return Object.values(originals);
    }
    async function get_originals_ids(){
        const key = get_storage_key() + '_ids';
        const ids_json = await UserScript.getValue(key, '[]');
        return JSON.parse(ids_json);
    }
    async function set_originals(originals){
        ORIGINALS = originals;
        await save_originals();
    }
    function save_originals(){
        const key = get_storage_key();
        const origs_json = JSON.stringify(ORIGINALS);
        const origs_promise = UserScript.setValue(key, origs_json);
        
        // since the IDS are used very often, we'll save those separately so
        // that they can be deserialized faster
        const ids_key = key + '_ids';
        const ids = Object.keys(ORIGINALS);
        const ids_json = JSON.stringify(ids);
        const ids_promise = UserScript.setValue(ids_key, ids_json);
        
        return Promise.all([origs_promise, ids_promise]);
    }


    /* ===========
     * ADD/REMOVE ORIGINALS
     * ===========
    */

    /* 
     * Creates the button that adds/removes a question to/from the collection.
     */
    function make_collection_toggle_button(){
        const fav_button = document.querySelector('.js-bookmark-btn');
        if (fav_button === null){
            return;
        }
        
        const toggle_button = document.createElement('BUTTON');
        toggle_button.id = 'toggle-original-button';
        toggle_button.onclick = toggle_in_collecton;
        toggle_button.classList.add('is-original-off', 's-btn', 's-btn__unset');
        
        const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        icon.innerHTML = ICON_CODE;
        icon.setAttribute('viewBox', '0 0 50 50');
        icon.style.width = icon.style.height = '22px';
        toggle_button.appendChild(icon);
        
        const parent = fav_button.parentElement;
        parent.appendChild(toggle_button);
    }

    /*
     * Updates the UI (the state of the button, and the existence of the keywords
     * textbox) to reflect the duplicate status of the question.
     */
    async function refresh_in_collection_status(state){
        const id = page.question.id;
        const toggle_button = document.getElementById('toggle-original-button');
        
        if (state === undefined){
            const ids = await get_originals_ids();
            state = ids.includes(id);
        }
        
        // set the button state
        if (state){
            toggle_button.classList.add('is-original-on');
            toggle_button.title = 'Click to remove this question from your collection of duplicate targets';
        } else {
            toggle_button.classList.remove('is-original-on');
            toggle_button.title = 'Click to add this question to your collection of duplicate targets';
        }
        
        // add or remove the keyword editor
        const keyword_list = document.getElementById('original-keyword-list-container');
        if (state){
            if (keyword_list === null){
                make_keyword_list();
            }
        } else {
            if (keyword_list !== null){
                keyword_list.remove();
            }
        }
    }

    /*
     * Toggles the status of the currently opened question - adds/removes it from
     * the collection.
     */
    async function toggle_in_collecton(){
        const collection = await get_originals(true);
        const id = page.question.id;
        const state = collection.hasOwnProperty(id);
        
        if (state){
            delete collection[id];
        } else {
            collection[id] = {
                id: page.question.id,
                title: page.question.title,
                text: page.question.extract_text(),
                tags: page.question.tags,
                keywords: [],
            };
        }
            
        await set_originals(collection);
        await refresh_in_collection_status(!state);
    }

    /* ===========
     * MISC DOM ELEMENT CREATION
     * ===========
    */

    /*
     * Creates an empty dialog with an optional title. The dialog is centered
     * on the screen.
     */
    function make_popup_dialog(title){
        const dialog = document.createElement('div');
        dialog.classList.add('popup', 'popup-dialog');
        
        // add a close button
        const close_container = document.createElement('div');
        close_container.classList.add('popup-close');
        
        const close_button = document.createElement('a');
        close_button.textContent = '×';
        close_button.addEventListener('click', function(){
            dialog.remove();
        });
        
        close_container.appendChild(close_button);
        dialog.appendChild(close_container);
        
        // add a title
        if (title !== undefined){
            const header = document.createElement('h1');
            header.classList.add('dialog-title');
            header.textContent = title;
            
            dialog.appendChild(header);
        }
        
        return dialog;
    }


    /* 
     * Creates the keyword input element for questions that have been added to the
     * collection.
     */
    async function make_keyword_list(){
        const container = document.createElement('div');
        container.id = 'original-keyword-list-container';
        
        const label = document.createElement('label');
        label.textContent = 'Keywords:  ';
        container.appendChild(label);
        
        const keyword_list = document.createElement('input');
        keyword_list.type = 'text';
        keyword_list.id = 'original-keyword-list';
        keyword_list.addEventListener('focusout', save_keywords);
        keyword_list.addEventListener('keypress', function(e){
            if (e.char === '\n'){
                save_keywords();
            }
        });
        
        const collection = await get_originals();
        const original = collection[page.question.id];
        keyword_list.value = original.keywords.join(' ');
        // for (const keyword of duplicate.keywords){
            // keyword_list.value += keyword + ' ';
        // }
        
        container.appendChild(keyword_list)
        
        const keyword_list_parent = document.querySelector('.post-taglist');
        keyword_list_parent.appendChild(container);
    }
    async function save_keywords(){
        const keyword_list = document.getElementById('original-keyword-list');
        const keywords = keyword_list.value.split(/\s+/).filter((e) => e);
        
        const collection = await get_originals();
        const original = collection[page.question.id];
        original.keywords = keywords;
        
        await save_originals();
    }

    /* ===========
     * CLOSE DIALOG AND QUESTION SEARCH
     * ===========
    */

    /*
     * Selects a duplicate target based on its URL, showing a preview of the
     * question and enabling the "close" button
     */
    function insert_original_selection(target_url){
        const searchbar = document.getElementById('duplicate-manager-searchbar');
        searchbar.value = target_url;
        
        const old_searchbar = document.getElementById('search-text');
        old_searchbar.value = target_url;
        
        // trigger a keypress event so that SO notices the change
        old_searchbar.dispatchEvent(new KeyboardEvent('keydown', {'key': ' '}));
        
        // for some reason the "back to similar questions" button doesn't appear,
        // so we'll make our own
        add_back_to_original_suggestions_button();
    }

    /*
     * Selects a duplicate suggestion, showing a preview of the
     * question and enabling the "close" button
     */
    function select_original_suggestion(original){
        // insert it into the text box
        insert_original_selection(document.location.origin + '/questions/' + original.id);
    }

    /*
     * Creates a "back to the suggestions" button that hides the preview and returns
     * to the list of duplicate suggestions.
     */
    function add_back_to_original_suggestions_button(){
        // for some reason the button is automatically added when we're on the
        // gold-badge holder "edit duplicate list" page, but anywhere else it's
        // not. We'll just make our own button and hide the original one with CSS.
        const nav_container = document.querySelector('.navi-container');
        
        var link = nav_container.querySelector('a.back-to-originals');
        if (link !== null){
            return;
        }
            
        link = document.createElement('a');
        link.classList.add('back-to-originals');
        link.textContent = '< back to suggested duplicate targets';
        link.addEventListener('click', return_to_originals_list);
        nav_container.appendChild(link);
    }
    function return_to_originals_list(e){
        const nav_container = document.querySelector('.navi-container');
        nav_container.lastChild.remove();
        
        const container = nav_container.parentElement;
        container.querySelector('.preview').style.display = 'none';
        container.querySelector('.list-container').style.display = 'block';
        
        // reset the value of the old searchbar, otherwise it won't react if the
        // same question is selected again
        const old_searchbar = document.getElementById('search-text');
        old_searchbar.value = '';
        
        // trigger a keypress event so that SO notices the change
        old_searchbar.dispatchEvent(new KeyboardEvent('keydown', {'key': ' '}));
    }

    /*
     * Creates a clickable summary of a question for use in the list of
     * suggestions/search results.
     */
    function create_original_list_item(original){
        const container = document.createElement('div');
        container.classList.add('item', 'duplicate-target');
        container.dataset.question_id = original.id;
        container.addEventListener('click', function(e){
            select_original_suggestion(original);
            e.preventDefault();
        }, true);
        
        // summary
        const summary_container = document.createElement('div');
        summary_container.classList.add('summary');
        
        // title
        const title_container = document.createElement('div');
        title_container.classList.add('post-link');
        
        const title = document.createElement('a');
        title.classList.add('title');
        title.href = '/questions/' + original.id;
        title.target = '_blank';
        title.textContent = original.title;
        title_container.appendChild(title);
        
        if (original.num_votes !== undefined){
            const votes_indicator = document.createElement('span');
            votes_indicator.classList.add('bounty-indicator-tab');
            votes_indicator.textContent = original.num_votes;
            
            title_container.appendChild(votes_indicator);
        }
        
        summary_container.appendChild(title_container);
        // end of title
        
        if (original.text !== null){
            const summary = document.createElement('span');
            summary.classList.add('body-summary');
            summary.textContent = original.text.substr(0, 200) + ' ...';
            summary_container.appendChild(summary);
        }
            
        container.appendChild(summary_container);
        // end of summary
        
        // keywords
        const keyword_list = document.createElement('span');
        keyword_list.classList.add('original-keyword-list');
        
        for (const keyword of original.keywords){
            const kw_element = document.createElement('a');
            kw_element.classList.add('post-tag', 'original-keyword');
            kw_element.textContent = keyword;
            
            keyword_list.appendChild(kw_element);
        }
        
        container.appendChild(keyword_list);
        // end of keywords
        
        return container;
    }


    /*
     * Clears the list of suggested originals and fills it with the best matches
     * for the current question and search terms.
     */
    async function insert_suggestions(clear_other_suggestions){
        const searchbar = document.getElementById('duplicate-manager-searchbar');
        const searchterm = searchbar.value.toLowerCase();
        
        // if it's a question url, use that as the dupe target
        const host = document.location.hostname;
        if (searchterm.includes(host)){
            insert_original_selection(searchterm);
            return;
        }
        
        // clear the suggestion list
        const list_elem = document.getElementById('originals-list');
        while (list_elem.firstChild){
            list_elem.removeChild(list_elem.firstChild);
        }
        
        // search for related questions
        const originals = await get_originals_list();
        const search_terms = new Set(searchterm.split(/\s+/));
        
        const is_question_page = !window.location.href.includes('/originals/');
        
        var question_text = "";
        if (is_question_page){
            question_text = page.question.extract_text().toLowerCase();
        }
        
        function rate_original(original){
            function compare(term, word, weight){
                var score = 0.0;

                word = word.toLowerCase();
                term = term.toLowerCase();

                if (word.includes(term)){
                    score += term.length * weight;

                    if (term == word){
                        score *= 1.5;
                    }
                }

                return score;
            }

            // if the current question doesn't have a single tag in common with the
            // suggested question, it's out. This is to prevent questions about
            // language X from showing up on questions about language Y.
            if (is_question_page){
                var ok = false;
                for (const tag of original.tags){
                    if (page.question.tags.includes(tag)
                            || search_terms.has(tag.toLowerCase())){
                        ok = true;
                        break;
                    }
                }
                if (!ok && !original.tags.includes('language-agnostic')){
                    return -1;
                }
            }
            
            var score = 0;
            
            for (const term of search_terms){
                // check if any keywords match the search terms
                for (var kword of original.keywords){
                    score += compare(term, kword, 5);
                }

                // check if any tags match the search terms
                for (var tag of original.tags){
                    score += compare(term, tag, 4);
                }

                // check if the question title contains this search term
                score += compare(term, original.title, 3);
                
                // check if the question text contains this search term
                score += compare(term, original.text, 1);
            }
            
            // check how many of the original's keywords the question contains
            for (const keyword of original.keywords){
                if (question_text.includes(keyword.toLowerCase())){
                    score += 1;
                }
            }
            
            return score;
        }
        
        // rate each suggestion
        var suggestions = originals.map(q => [rate_original(q), q]);
        // remove the junk
        suggestions = suggestions.filter(pair => pair[0] >= 0);
        // sort in descending order
        suggestions = suggestions.sort((a, b) => b[0] - a[0]);
        // take the best few candidates
        suggestions = suggestions.slice(0, 8);
        // remove the rating we used for the sort
        suggestions = suggestions.map(pair => pair[1]);
        
        for (const original of suggestions){
            add_original_suggestion(original);
        }
    }

    /*
     * Displays an initial batch of suggested originals and questions from other
     * close voters.
     */
    async function insert_initial_suggestions(){
        if (document.location.href.includes('/originals/')){
            await insert_suggestions();
            return;
        }
        
        const DUPE_MSG = 'Possible duplicate of ';
        const suggested_dupe_comments = page.question.comments.filter(c => c.text.startsWith(DUPE_MSG));
        
        if (suggested_dupe_comments.length == 0){
            await insert_suggestions();
            return;
        }
        
        for (const comment of suggested_dupe_comments){
            const item = {
                id: /\/(\d+)\//.exec(comment.querySelector('.comment-copy a').href)[1],
                title: comment.text.substring(DUPE_MSG.length),
                text: null,
                tags: [],
                keywords: [],
                num_votes: comment.score + 1,
            };
            
            add_original_suggestion(item);
        }
    }

    function add_original_suggestion(original){
        const list_elem = document.getElementById('originals-list');
        
        const item = create_original_list_item(original);
        list_elem.appendChild(item);
    }

    /*
     * Replaces the default search in the close dialog with our custom search.
     */
    function hijack_original_search(){
        if (document.getElementById('duplicate-manager-searchbar') !== null){
            return;
        }
        
        const dupe_tab = document.querySelector('.close-as-duplicate-pane');
        
        const old_searchbar = document.getElementById('search-text');
        
        const searchbar = document.createElement('input');
        searchbar.id = 'duplicate-manager-searchbar';
        searchbar.type = 'text';
        searchbar.style.width = '100%';
        searchbar.addEventListener('input', insert_suggestions);
        
        old_searchbar.parentElement.insertBefore(searchbar, old_searchbar);
        old_searchbar.style.display = 'none';
        
        const orig_display = dupe_tab.querySelector('.original-display');
        
        // we have to create some parent elements with the appropriate classes
        // so that the correct CSS styles apply
        const list_container = document.createElement('div');
        list_container.classList.add('list-container');
        
        const list_origs = document.createElement('div');
        list_origs.classList.add('list-originals');
        
        const suggestions_list = document.createElement('div');
        suggestions_list.id = 'originals-list';
        suggestions_list.classList.add('list');
        
        list_origs.appendChild(suggestions_list);
        list_container.appendChild(list_origs);
        orig_display.querySelector('.list-container').remove();
        orig_display.appendChild(list_container);
        
        // searchbar.focus();
        window.setTimeout(() => searchbar.focus(), 50);
        
        // add suggested duplicates, but leave other people's suggestions alone
        insert_initial_suggestions();
    }

    /*
     * Waits for the close dialog to be created and then replaces the default search.
     */
    function wait_for_dialog_and_hijack_original_search(){
        const dialog_parent = document.querySelector('.container');
        
        const config = {childList: true, subtree: true};
        run_after_last_mutation(hijack_original_search, 50, dialog_parent, config);
    }

    /* ===========
     * PROFILE TAB
     * ===========
    */

    /*
     * Adds a "duplicates" tab to the navigation menu on the user's profile page.
     */
    function make_originals_collection_tab(){
        const neighbor_tab = document.querySelector('.s-navigation a[href$="?tab=bounties"]');
        
        const button = document.createElement('a');
        button.textContent = 'Duplicates';
        button.title = 'Your collection of duplicate targets';
        button.id = 'originals-collection-tab-button';
        button.classList.add('s-navigation--item');
        button.addEventListener('click', populate_originals_collection_tab);
        
        neighbor_tab.parentElement.insertBefore(button, neighbor_tab);
    }

    /*
     * Displays the complete list of originals in the "duplicates" tab.
     */
    async function populate_originals_collection_tab(){
        for (const button of document.querySelectorAll('.s-navigation a')){
            if (button.id === 'originals-collection-tab-button'){
                button.classList.add('youarehere');
            } else {
                button.classList.remove('youarehere');
            }
        }
        
        const originals = await get_originals_list();
        
        const tab = document.createElement('div');
        tab.id = 'duplicate-targets-tab';
        tab.classList.add('user-tab');
        
        // create the "123 Duplicate targets" header
        const subheader = document.createElement('div');
        subheader.classList.add('subheader', 'user-full-tab-header');
        
        const count_heading = document.createElement('h1');
        
        const count_span = document.createElement('span');
        count_span.classList.add('count');
        count_span.textContent = originals.length;
        
        count_heading.appendChild(count_span);
        count_heading.appendChild(new Text(' Duplicate targets'));
        
        subheader.appendChild(count_heading);
        
        // create the "import" and "export" buttons
        const port_menu = document.createElement('span');
        port_menu.classList.add('import-export-buttons');
        
        const import_button = document.createElement('a');
        import_button.textContent = 'import';
        import_button.addEventListener('click', show_import_dialog);
        
        const export_button = document.createElement('a');
        export_button.textContent = 'export';
        export_button.addEventListener('click', show_export_dialog);
        
        port_menu.appendChild(import_button);
        port_menu.appendChild(export_button);
        subheader.appendChild(port_menu);
        
        tab.appendChild(subheader);
        
        // create the list of questions
        const list_container = document.createElement('div');
        list_container.classList.add('user-tab-content');
        
        const originals_list = document.createElement('div');
        originals_list.classList.add('originals-collection');
        
        for (const original of originals){
            const item = create_original_list_item(original);
            originals_list.appendChild(item);
        }
        
        list_container.appendChild(originals_list);
        tab.appendChild(list_container);
        
        // remove the current tab and insert the one we just created instead
        const curtab = document.querySelector('#mainbar-full > div:last-child');
        curtab.parentElement.appendChild(tab);
        curtab.remove();
    }

    /*
     * Creates the dialog used by the "import" and "export" buttons
     */
    function make_import_export_dialog(title, text){
        const dialog = make_popup_dialog(title);
        dialog.id = 'import-export-dialog';
        
        const text_elem = document.createElement('span');
        text_elem.textContent = text;
        dialog.appendChild(text_elem);
        
        const textarea = document.createElement('textarea');
        dialog.appendChild(textarea);
        
        return dialog;
    }
    function show_import_dialog(){
        const dialog = make_import_export_dialog(
            "Import duplicate collection",
            "Paste your JSON dump here:"
        );
        
        function refresh_list(){
            const tab = document.getElementById('duplicate-targets-tab');
            while (tab.firstChild){
                tab.firstChild.remove();
            }
            
            populate_originals_collection_tab();
        }
        
        const add_button = document.createElement('button');
        add_button.textContent = 'Add to collection';
        add_button.addEventListener('click', async function(){
            const json_dump = dialog.querySelector('textarea').value;
            const collection = JSON.parse(json_dump);
            
            const originals = await get_originals();
            Object.assign(originals, collection);
            await set_originals(originals);
            
            dialog.remove();
            refresh_list();
        });
        dialog.appendChild(add_button);
        
        const replace_button = document.createElement('button');
        replace_button.textContent = 'Overwrite collection';
        replace_button.addEventListener('click', async function(){
            const json_dump = dialog.querySelector('textarea').value;
            const collection = JSON.parse(json_dump);
            await set_originals(collection);
            
            dialog.remove();
            refresh_list();
        });
        dialog.appendChild(replace_button);
        
        document.body.appendChild(dialog);
    }
    async function show_export_dialog(){
        const dialog = make_import_export_dialog(
            "Export duplicate collection",
            "Here's a JSON dump of your duplicate collection:"
        );
        
        const collection = await get_originals(true);
        dialog.querySelector('textarea').value = JSON.stringify(collection);
        
        document.body.appendChild(dialog);
    }

    /* ===========
     * END OF FUNCTION DEFINITIONS
     * ===========
    */
    add_style(`
/* =================
 * COLLECTION BUTTON
 * =================
*/
.is-original-off {
    display: block;
    margin-top: 5px;
    fill: #AAA;
}

.is-original-on {
    fill: #BFB615;
}

/* ============================
 * ORIGINALS SUGGESTIONS DIALOG
 * ============================
*/
/* this hides the original "< back to similar questions" button */
.navi-container .navi a:not(.back-to-originals) {
    display: none;
}

#original-keyword-list-container {
    display: flex;
}

#original-keyword-list-container label {
    margin-top: auto;
    margin-bottom: auto;
}

#original-keyword-list {
    margin-left: 0.2em;
    padding: 0.2em;
    flex: auto;
    display: block;
}

.item.duplicate-target {
    display: flex;
    flex-direction: column;
    float: unset !important;
}

.close-as-duplicate-pane .original-display .list-originals .list .item.duplicate-target .summary {
    width: unset;
}

.original-keyword-list {
    margin-top: 0.2em;
}

.post-tag.original-keyword {
    padding: 0.2em 0.4em !important;
}

/* ================
 * "DUPLICATES" TAB
 * ================
*/
.originals-collection .item {
    padding-bottom: 0.45em;
    margin-bottom: 0.3em;
    border-bottom: 1px solid #eff0f1;
}
.originals-collection .post-link {
    margin-bottom: 0.3em;
}
.originals-collection .title {
    font-size: 1.3em;
}

.import-export-buttons {
    float: right;
}
.import-export-buttons > *:first-child {
    padding-right: 0.4em;
    border-right: thin solid #eff0f1;
    margin-right: 0.4em;
}

#import-export-dialog {
    min-width: 50%;
    min-height: 20%;
}

/* =============
 * POPUP DIALOGS
 * =============
*/
.popup.popup-dialog {
    display: block;
    position: fixed;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
}

.popup-close {
    float: right;
}

.popup-dialog .dialog-title {
    margin-bottom: 1em;
}
    `);

    if (document.location.href.includes('/users/')){
        if (document.querySelector('#mainbar-full .s-navigation a[href^="/users/edit/"]') !== null){
            make_originals_collection_tab();
        }
    } else {
        if (!document.location.href.includes('/originals/')){
            make_collection_toggle_button();
            page.transform_question((q) => refresh_in_collection_status(), Rerun.AFTER_CHANGE);
        }

        function on_click(event){
            // check if the "Add duplicate" gold-badge holder button was pressed
            if (event.target.classList.contains('js-add-orig')){
                wait_for_dialog_and_hijack_original_search();
                return;
            }
            
            // check if the "close as duplicate" button was pressed
            const li = find_parent(event.target, (p => p.tagName === 'LI'));
            if (li === null){
                return;
            }
            
            const reason_elem = li.querySelector('input');
            if (reason_elem === null){
                return;
            }
            
            if (reason_elem.dataset.subpaneName === 'duplicate'){
                hijack_original_search();
            }
        }
        document.addEventListener('click', on_click);
    }
})();
