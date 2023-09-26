import { AccessControlled, AccessLevel } from "@/types";
import { Data } from "./session";

/**
 * Checks if the user has access to an item and returns their access level. An empty string means no access.
 * @param item An object that implements the `AccessControlled` interface
 * @param user The user object from the session
 * @returns A string representing the user's access level to the item; "", "VIEW", "EDIT", or "ADMIN", based on the `AccessLevel` enum
 */
export default function accessChecker(item: AccessControlled, user: Data["user"]): AccessLevel {
  // User is not signed in
  if (!user) {
    if (item.viewGroups?.map(group => group.name).includes("Public")) return AccessLevel.View;
    return AccessLevel.None;
  }

  // User is admin
  if (user?.isAdmin) return AccessLevel.Admin;

  // User is editor
  if (item.author.id === user.id) return AccessLevel.Edit;
  if (item.editors?.map(editor => editor.id).includes(user.id)) return AccessLevel.Edit;
  if (item.editGroups?.map(group => group.name).some(name => user.userGroups?.includes(name))) return AccessLevel.Edit;

  // User is viewer
  if (item.viewers?.map(viewer => viewer.id).includes(user.id)) return AccessLevel.View;
  if (item.viewGroups?.map(group => group.name).some(name => user.userGroups?.includes(name))) return AccessLevel.View;

  // User does not have access
  return AccessLevel.None;
}