// ==UserScript==
// @name          SEReopenReviewWarning
// @namespace     http://vulpin.com/
// @description   Warns users that there is a pending/completed reopen review on a question
// @match         *://*.askubuntu.com/*
// @match         *://*.mathoverflow.net/*
// @match         *://*.onstartups.com/*
// @match         *://*.serverfault.com/*
// @match         *://*.stackapps.com/*
// @match         *://*.stackexchange.com/*
// @match         *://*.stackoverflow.com/*
// @match         *://*.superuser.com/*
// @version       1.0.1
// @grant         unsafeWindow
// @run-at        document-end
// ==/UserScript==

function isQuestionPage() {
    return document.body.classList.contains('question-page');
}

function isClosed() {
    return document.querySelector('.close-status-suffix') !== null;
}

function addNotice(noticeHeading, noticeBody) {
    const existingNotice = document.querySelector('.special-status>.question-status');

    const newNotice = document.createElement('div');
    newNotice.classList.add('special-status');
    const statusWrapper = newNotice.appendChild(document.createElement('div'));
    statusWrapper.classList.add('question-status');

    const statusHeading = statusWrapper.appendChild(document.createElement('h2'));
    statusHeading.appendChild(noticeHeading);

    const statusBody = statusWrapper.appendChild(document.createElement('p'));
    statusBody.appendChild(noticeBody);

    existingNotice.parentNode.insertBefore(newNotice, existingNotice.nextSibling);
}

function getQuestionId() {
    return document.getElementById('question').dataset.questionid;
}

async function getTimelineDocument(questionId) {
    const response = await unsafeWindow.fetch('/posts/' + questionId + '/timeline');
    const responseText = await response.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(responseText, 'text/html');

    return doc;
}

async function getLastReopen(questionId) {
    const timelineDoc = await getTimelineDocument(questionId);

    const rowContainer = timelineDoc.querySelector('.event-rows');

    for (let currentRow = rowContainer.firstElementChild; currentRow; currentRow = currentRow.nextElementSibling) {
        // go top-down to find first relevant event
        const verbNode = currentRow.querySelector('.event-verb');
        if (!verbNode) {
            continue;
        }
        const verb = verbNode.textContent.trim();

        if (verb === 'closed') {
            return; // no reopens since last close
        }

        if (verb === 'reopen') {
            const lastReopen = {
                reviewUrl: verbNode.querySelector('a').href
            };

            const nextRow = currentRow.nextElementSibling;
            if (nextRow) {
                const nextVerbNode = nextRow.querySelector('.event-verb');
                if (nextVerbNode) {
                    const nextVerb = nextVerbNode.textContent.trim();
                    if (nextVerb === 'completed') {
                        lastReopen.isCompleted = true;
                    }
                }
            }

            return lastReopen;
        }
    }
}

async function main() {
    if (!isQuestionPage()) {
        return;
    }

    const questionId = getQuestionId();

    if (isClosed()) {
        const lastReopen = await getLastReopen(questionId);
        if (lastReopen) {
            const noticeHeading = document.createElement('span');
            const noticeBody = document.createElement('span');

            noticeHeading.innerHTML = 'A ' + (lastReopen.isCompleted ? 'completed' : 'pending') + ' <a href="' + lastReopen.reviewUrl + '" target="_blank">reopen review</a> has been found';

            if (lastReopen.isCompleted) {
                noticeBody.textContent = 'Reopen review has been completed. This question will not appear in the Reopen Review queue again. If you believe it should be reopened, please use other means to have it reconsidered.';
            } else {
                noticeBody.textContent = 'Any existing votes will not be reset by future edits.';
            }

            addNotice(noticeHeading, noticeBody);
        }
    }
}

main();
