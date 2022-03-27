/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * This reducer is for managing the control flow of loading and updating a
 * conversation.
 */

import * as RTK from "@reduxjs/toolkit";
import { composeSlice } from "./reducerCompose.js";
import { controllerActions } from "./controllerActions.js";
import { mergeContactDetails } from "./contacts.js";
import { messageActions } from "./reducerMessages.js";
import { MessageEnricher } from "./messageEnricher.js";
import { quickReplySlice } from "./reducerQuickReply.js";
import { summaryActions } from "./reducerSummary.js";

export const initialConversation = {
  currentId: 0,
};

let currentQueryListener;
let currentQueryListenerArgs;

function removeListeners() {
  if (currentQueryListener) {
    browser.convGloda.queryConversationMessages.removeListener(
      currentQueryListener,
      currentQueryListenerArgs
    );
    currentQueryListener = null;
    currentQueryListenerArgs = null;
  }
}

window.addEventListener(
  "unload",
  () => {
    removeListeners();
  },
  { once: true }
);

export const conversationActions = {
  showConversation({ msgIds }) {
    return async (dispatch, getState) => {
      let loadingStartedTime = Date.now();

      removeListeners();

      let currentId = getState().conversation.currentId + 1;
      await dispatch(conversationActions.setConversationId({ currentId }));
      await dispatch(composeSlice.actions.resetStore());
      await dispatch(
        quickReplySlice.actions.setExpandedState({ expanded: false })
      );

      currentQueryListener = (event) => {
        if (event.initial) {
          dispatch(
            conversationActions.displayConversationMsgs({
              msgs: event.initial,
              initialSet: msgIds,
              loadingStartedTime,
            })
          );
        } else if (event.added) {
          console.log("Added", event.added);
          dispatch(
            conversationActions.addConversationMsgs({
              msgs: event.added,
            })
          );
        } else if (event.removed) {
          dispatch(
            messageActions.removeMessages({
              msgs: event.removed,
            })
          );
        }
      };
      currentQueryListenerArgs = msgIds;

      browser.convGloda.queryConversationMessages.addListener(
        currentQueryListener,
        currentQueryListenerArgs
      );
    };
  },
  displayConversationMsgs({ msgs, initialSet, loadingStartedTime }) {
    return async (dispatch, getState) => {
      let phase2StartTime = new Date();
      let messages = msgs.map((msg, i) => {
        return {
          ...msg,
          initialPosition: i,
          detailsShowing: false,
        };
      });

      let summary = { initialSet };
      let currentState = getState();
      // The messages need some more filling out and tweaking.
      let messageEnricher = new MessageEnricher();
      let enrichedMsgs = await messageEnricher.enrich(
        // TODO: eliminate the need? - depends on remote content for modifying messages.
        "replaceAll",
        messages,
        currentState.summary,
        initialSet
      );

      // Do expansion and scrolling after gathering the message data
      // as this relies on the message read information.
      messageEnricher.determineExpansion(
        enrichedMsgs,
        currentState.summary.prefs.expandWho,
        initialSet
      );

      // The messages inside `msgData` don't come with filled in `to`/`from`/ect. fields.
      // We need to fill them in ourselves.
      await mergeContactDetails(enrichedMsgs);

      summary.loading = false;
      summary.subject = enrichedMsgs[enrichedMsgs.length - 1]?.subject;

      await dispatch(summaryActions.replaceSummaryDetails(summary));

      await dispatch(
        messageActions.replaceConversation({ messages: enrichedMsgs })
      );

      if (currentState.summary.prefs.loggingEnabled) {
        console.debug(
          "Conversations:",
          "Load took (ms):",
          Date.now() - loadingStartedTime
        );
        console.debug(
          "Conversations:",
          "Second phase took (ms):",
          Date.now() - phase2StartTime
        );
      }
      // TODO: Fix this for the standalone message view, so that we send
      // the correct notifications.
      if (!currentState.summary.isInTab) {
        await browser.convMsgWindow.fireLoadCompleted();
      }
      await dispatch(controllerActions.maybeSetMarkAsRead());
    };
  },
  addConversationMsgs({ msgs }) {
    return async (dispatch, getState) => {
      let currentState = getState();
      let currentMsgCount = currentState.messages.msgData.length;
      let messages = msgs.map((msg, i) => {
        return {
          ...msg,
          initialPosition: i + currentMsgCount,
          detailsShowing: false,
        };
      });

      // TODO: eliminate the need?
      let mode = "replaceAll";
      // The messages need some more filling out and tweaking.
      let messageEnricher = new MessageEnricher();
      let enrichedMsgs = await messageEnricher.enrich(
        mode,
        messages,
        currentState.summary,
        currentState.summary.initialSet
      );

      for (let msg of enrichedMsgs) {
        messageEnricher.markExpansionForAddedMsg(
          msg,
          currentState.summary.expandWho
        );
      }

      // The messages inside `msgData` don't come with filled in `to`/`from`/ect. fields.
      // We need to fill them in ourselves.
      await mergeContactDetails(enrichedMsgs);

      await dispatch(
        messageActions.addMessages({
          msgs: enrichedMsgs,
        })
      );
    };
  },
};

export const conversationSlice = RTK.createSlice({
  name: "conversation",
  initialState: initialConversation,
  reducers: {
    setConversationId(state, { payload }) {
      return { ...state, currentId: payload.currentId };
    },
  },
});

Object.assign(conversationActions, conversationSlice.actions);