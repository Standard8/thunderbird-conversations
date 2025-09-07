/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import React from "react";

const ActionsToInfoMap = {
  draft: {
    title: "action.editDraft",
    icon: "edit",
  },
  editAsNew: {
    title: "action.editNew",
    icon: "edit",
  },
  reply: {
    title: "action.reply",
    icon: "reply",
  },
  replyAll: {
    title: "action.replyAll",
    icon: "reply_all",
  },
  replyList: {
    title: "action.replyList",
    icon: "list",
  },
  forward: {
    title: "action.forward",
    icon: "forward",
  },
  archive: {
    title: "action.archive",
    icon: "archive",
  },
  delete: {
    title: "action.delete",
    icon: "delete",
  },
  classic: {
    title: "action.viewClassic",
    icon: "open_in_new",
  },
  source: {
    title: "action.viewSource",
    icon: "code",
  },
  deleteAttachment: {
    title: "attachments.context.delete",
    icon: "delete_forever",
  },
  detachAttachment: {
    title: "attachments.context.detach",
    icon: "save_alt",
  },
};

/**
 * @typedef callbackParams
 * @property {object} args
 * @property {string} args.type
 * @property {boolean} args.shiftKey
 */

/**
 * Defines an action button.
 *
 * @param {object} props
 * @param {(callbackParams, Event) => void} props.callback
 * @param {string} [props.className]
 * @param {boolean} [props.showString]
 * @param {string} props.type
 */
export function ActionButton({ type, callback, className, showString }) {
  const info = ActionsToInfoMap[type];
  const title = browser.i18n.getMessage(info.title);

  function action(event) {
    callback(
      {
        type,
        shiftKey: event && event.shiftKey,
      },
      event
    );
  }

  return React.createElement(
    "button",
    { className: className || "", title, onClick: action },
    React.createElement("svg-icon", { "aria-hidden": true, hash: info.icon }),
    " ",
    !!showString && title
  );
}
