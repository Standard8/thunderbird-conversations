/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
/* eslint-env jest, node */

// Standard imports for all tests

const { esmImport, browser } = require("./utils");

global.browser = browser;

const { Contacts } = esmImport("../contacts.js");

describe("Contacts setup", () => {
  test("can be constructed", async () => {
    expect(new Contacts()).not.toBeNull();
  });

  test("can be initialized", async () => {
    let contacts = new Contacts();
    contacts.init();
  });
});

describe("Getting contacts", () => {
  let contacts = new Contacts();
  browser.conversations.getCorePref = jest.fn().mockReturnValue(false);
  browser.convContacts.getIdentityEmails = jest
    .fn()
    .mockReturnValue(Promise.resolve([]));
  contacts.init();

  test("can get a contact object for an email", async () => {
    await expect(contacts.get("", "test@example.com", "from")).resolves.toEqual(
      {
        name: "test@example.com",
        initials: "TE",
        displayEmail: "",
        tooltipName: "",
        email: "test@example.com",
        avatar: "chrome://messenger/skin/addressbook/icons/contact-generic.png",
        contactId: null,
        extra: "",
        colorStyle: { backgroundColor: "hsl(11, 70%, 43%)" },
      }
    );
  });

  test("should return the same object when called a second time", async () => {
    await expect(contacts.get("", "test@example.com", "from")).resolves.toEqual(
      {
        name: "test@example.com",
        initials: "TE",
        displayEmail: "",
        tooltipName: "",
        email: "test@example.com",
        avatar: "chrome://messenger/skin/addressbook/icons/contact-generic.png",
        contactId: null,
        extra: "",
        colorStyle: { backgroundColor: "hsl(11, 70%, 43%)" },
      }
    );
  });

  test("should add a name for a cached contact if one is present", async () => {
    await expect(
      contacts.get("my name", "test@example.com", "from")
    ).resolves.toEqual({
      name: "my name",
      initials: "TE",
      displayEmail: "",
      tooltipName: "",
      email: "test@example.com",
      avatar: "chrome://messenger/skin/addressbook/icons/contact-generic.png",
      contactId: null,
      extra: "",
      colorStyle: { backgroundColor: "hsl(11, 70%, 43%)" },
    });
  });
});
