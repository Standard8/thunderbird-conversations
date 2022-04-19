/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { createFakeData } from "./utils.js";
import { jest } from "@jest/globals";
import * as RTK from "@reduxjs/toolkit";
import * as Redux from "redux";

// Import the components we want to test
import { controllerActions } from "../content/reducer/controllerActions.js";
import { messageActions } from "../content/reducer/reducerMessages.js";
import { summarySlice } from "../content/reducer/reducerSummary.js";

const summaryApp = Redux.combineReducers({
  summary: summarySlice.reducer,
});

const store = RTK.configureStore({ reducer: summaryApp });

describe("Controller Actions tests", () => {
  let fakeMessageHeaderData;

  beforeEach(() => {
    fakeMessageHeaderData = new Map();
    jest
      .spyOn(browser.messages, "get")
      .mockImplementation(async (id) => fakeMessageHeaderData.get(id));
  });

  describe("updateConversation", () => {
    beforeEach(() => {
      messageActions.updateConversation = jest.fn(() => {
        return { type: "mock" };
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test("Enriches message data", async () => {
      let now = new Date();
      let fakeMsg = createFakeData(
        {
          date: now,
          snippet: "My message snippet",
        },
        fakeMessageHeaderData
      );
      await store.dispatch(
        controllerActions.updateConversation({
          messages: {
            msgData: [fakeMsg],
          },
          mode: "replaceAll",
          summary: {
            initialSet: [fakeMsg.id],
          },
        })
      );

      expect(messageActions.updateConversation).toHaveBeenCalled();
      let msgData = messageActions.updateConversation.mock.calls[0][0].messages;

      let date = new Intl.DateTimeFormat(undefined, {
        timeStyle: "short",
      }).format(now);

      createFakeData(
        {
          detailsShowing: false,
          snippet: "My message snippet",
        },
        fakeMessageHeaderData
      );

      // jest doesn't seem to work properly with an object within an array, and
      // we don't need to test for _contactsData anyway as that is more internal.
      delete msgData[0].parsedLines;

      expect(msgData[0]).toStrictEqual({
        attachments: [],
        bcc: [],
        attachmentsPlural: "",
        cc: [],
        date: "yesterday",
        detailsShowing: false,
        expanded: true,
        folderAccountId: "id1",
        folderPath: undefined,
        from: undefined,
        fullDate: date,
        hasRemoteContent: false,
        id: 0,
        initialPosition: 0,
        isArchives: false,
        isDraft: false,
        isInbox: true,
        isJunk: false,
        isOutbox: false,
        isPhishing: false,
        isSent: false,
        isTemplate: false,
        messageHeaderId: undefined,
        multipleRecipients: false,
        rawDate: now.getTime(),
        read: false,
        realFrom: "",
        recipientsIncludeLists: false,
        scrollTo: true,
        source: "gloda",
        smimeReload: false,
        snippet: "My message snippet",
        starred: false,
        subject: "Fake Msg",
        tags: [],
        to: [],
        type: "normal",
      });
    });
  });
});
