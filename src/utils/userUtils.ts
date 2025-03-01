import type { APIInteractionGuildMember, GuildMember, User } from "discord.js";

import { getConfig } from "./configHandler.js";

const config = getConfig();

function hasRoleByName(member: GuildMember, roleName: string): boolean {
    return member.roles.cache.some(role => role.name === roleName);
}

function hasAnyRoleByName(member: GuildMember, roleNames: string[]) {
    return roleNames.some(role => hasRoleByName(member, role));
}

function hasRoleById(
    member: GuildMember | APIInteractionGuildMember,
    id: string,
): boolean {
    return Array.isArray(member.roles)
        ? member.roles.includes(id)
        : member.roles.cache.some(role => role.id === id);
}

export function isMarcel(user: User): boolean {
    return user.id === "878337496285605918" || user.id === "209413133020823552";
}

/**
 * Checks whether the provided member is a mod according to the configured moderator roles
 * @param member member
 * @returns true if mod
 */
export function isMod(member: GuildMember): boolean {
    return hasAnyRoleByName(member, config.bot_settings.moderator_roles);
}

export function isNerd(
    member: GuildMember | APIInteractionGuildMember,
): boolean {
    return hasRoleById(member, config.ids.default_role_id);
}

export function isTrusted(
    member: GuildMember | APIInteractionGuildMember,
): boolean {
    return hasRoleById(member, config.ids.trusted_role_id);
}

export function isWoisGang(
    member: GuildMember | APIInteractionGuildMember,
): boolean {
    return hasRoleById(member, config.ids.woisgang_role_id);
}
export function isEmotifizierer(
    member: GuildMember | APIInteractionGuildMember,
): boolean {
    return hasRoleById(member, config.ids.emotifizierer_role_id);
}

export function hasBotDenyRole(
    member: GuildMember | APIInteractionGuildMember,
): boolean {
    return hasRoleById(member, config.ids.bot_deny_role_id);
}
