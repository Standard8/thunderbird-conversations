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

describe("Getting unknown contacts", () => {
  let contacts = new Contacts();

  beforeAll(async () => {
    await contacts.init();
  });

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

describe("Getting known contacts", () => {
  let contacts = new Contacts();

  beforeAll(async () => {
    browser.convContacts.getIdentityEmails = jest
      .fn()
      .mockReturnValue(Promise.resolve([]));
    await contacts.init();
  });

  beforeEach(() => {
    browser.contacts.quickSearch = jest.fn().mockReturnValue(
      Promise.resolve([
        {
          id: "1",
          properties: {
            FirstName: "first",
            LastName: "last",
            DisplayName: "contact name",
            PrimaryEmail: "contact@example.com",
            SecondEmail: "second@example.com",
            PreferDisplayName: "1",
          },
          type: "contact",
          parentId: "2",
          readOnly: false,
        },
      ])
    );
  });

  test("should get a contact from the address book", async () => {
    await expect(
      contacts.get("", "contact@example.com", "from")
    ).resolves.toEqual({
      name: "contact name",
      initials: "CN",
      displayEmail: "",
      tooltipName: "contact name",
      email: "contact@example.com",
      avatar: "chrome://messenger/skin/addressbook/icons/contact-generic.png",
      contactId: "1",
      extra: "",
      colorStyle: { backgroundColor: "hsl(4, 70%, 46%)" },
    });
  });

  test("should cache contacts", async () => {
    await expect(
      contacts.get("", "contact@example.com", "from")
    ).resolves.toEqual({
      name: "contact name",
      initials: "CN",
      displayEmail: "",
      tooltipName: "contact name",
      email: "contact@example.com",
      avatar: "chrome://messenger/skin/addressbook/icons/contact-generic.png",
      contactId: "1",
      extra: "",
      colorStyle: { backgroundColor: "hsl(4, 70%, 46%)" },
    });

    expect(browser.contacts.quickSearch).not.toHaveBeenCalled();
  });

  test("should also cache alternate emails of contacts", async () => {
    await expect(
      contacts.get("", "second@example.com", "from")
    ).resolves.toEqual({
      name: "contact name",
      initials: "CN",
      displayEmail: "",
      tooltipName: "contact name",
      email: "second@example.com",
      avatar: "chrome://messenger/skin/addressbook/icons/contact-generic.png",
      contactId: "1",
      extra: "",
      colorStyle: { backgroundColor: "hsl(4, 70%, 46%)" },
    });

    expect(browser.contacts.quickSearch).not.toHaveBeenCalled();
  });
});
