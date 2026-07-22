// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Zalo CRM Team
// Auto Reply Service - rule-based auto chat for incoming Zalo messages
import type { FastifyRequest } from 'fastify';
import { prisma } from '../../shared/database/prisma-client.js';
import { logger } from '../../shared/utils/logger.js';
import { generateAiOutput } from '../ai/ai-service.js';

export type AutoReplyTriggerType = 'keyword' | 'regex' | 'tag' | 'time_window';
export type AutoReplyActionType = 'text' | 'image' | 'template' | 'ai_suggest';

interface MatchResult {
  matched: boolean;
  ruleId?: string;
  actionType?: AutoReplyActionType;
  actionContent?: string;
  aiReply?: string;
}

export interface AutoReplyRuleRecord {
  id: string;
  orgId: string;
  oaAccountId: string | null;
  name: string;
  triggerType: string;
  triggerValue: string;
  actionType: string;
  actionContent: string;
  priority: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Match incoming message against active rules for the org.
 * Returns highest-priority match.
 */
export async function matchAutoReply(
  orgId: string,
  oaAccountId: string | null,
  messageText: string
): Promise<MatchResult> {
  if (!messageText || !messageText.trim()) return { matched: false };

  const rules = await prisma.autoReplyRule.findMany({
    where: {
      orgId,
      enabled: true,
      OR: [{ oaAccountId: null }, ...(oaAccountId ? [{ oaAccountId }] : [])],
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
  });

  for (const rule of rules) {
    if (ruleMatches(rule.triggerType, rule.triggerValue, messageText)) {
      if (rule.actionType === 'ai_suggest') {
        try {
          const ai = await generateAiOutput({
            orgId,
            type: 'auto_reply',
            conversationId: rule.id, // fallback; real conv not needed for ad-hoc call
            customPrompt: `Trả lời tự động cho tin nhắn khách hàng: "${messageText}"`,
          } as any);
          return {
            matched: true,
            ruleId: rule.id,
            actionType: 'ai_suggest',
            actionContent: rule.actionContent,
            aiReply: (ai as any).content ?? rule.actionContent,
          };
        } catch (err) {
          logger.warn('[auto-reply] AI suggest failed: %s', (err as Error).message);
          return {
            matched: true,
            ruleId: rule.id,
            actionType: 'text',
            actionContent: rule.actionContent,
          };
        }
      }
      return {
        matched: true,
        ruleId: rule.id,
        actionType: rule.actionType as AutoReplyActionType,
        actionContent: rule.actionContent,
      };
    }
  }

  return { matched: false };
}

function ruleMatches(triggerType: string, triggerValue: string, message: string): boolean {
  try {
    switch (triggerType) {
      case 'keyword': {
        const keywords = triggerValue.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean);
        const lower = message.toLowerCase();
        return keywords.some((k) => lower.includes(k));
      }
      case 'regex':
        return new RegExp(triggerValue, 'i').test(message);
      case 'tag':
        return triggerValue.split(',').map((t) => t.trim()).some((t) => message.includes(`#${t}`));
      case 'time_window': {
        // triggerValue format: "HH:MM-HH:MM" or "[{"dayOfWeek":0,"from":"09:00","to":"18:00"}]"
        const now = new Date();
        const hour = now.getHours();
        const minute = now.getMinutes();
        const timeNum = hour * 60 + minute;
        try {
          const ranges = JSON.parse(triggerValue);
          if (Array.isArray(ranges)) {
            return ranges.some((r: any) => {
              if (r.dayOfWeek !== undefined && r.dayOfWeek !== now.getDay()) return false;
              const [fromH, fromM] = (r.from || '00:00').split(':').map(Number);
              const [toH, toM] = (r.to || '23:59').split(':').map(Number);
              const from = fromH * 60 + fromM;
              const to = toH * 60 + toM;
              return timeNum >= from && timeNum <= to;
            });
          }
        } catch { /* fall through to simple format */ }
        const [from, to] = triggerValue.split('-').map((s) => s.trim());
        const [fh, fm] = from.split(':').map(Number);
        const [th, tm] = to.split(':').map(Number);
        return timeNum >= fh * 60 + fm && timeNum <= th * 60 + tm;
      }
      default:
        return false;
    }
  } catch (err) {
    logger.warn('[auto-reply] rule match failed trigger=%s err=%s', triggerType, (err as Error).message);
    return false;
  }
}

export async function listRules(orgId: string): Promise<AutoReplyRuleRecord[]> {
  return prisma.autoReplyRule.findMany({
    where: { orgId },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
  });
}

export async function createRule(orgId: string, data: Partial<AutoReplyRuleRecord>): Promise<AutoReplyRuleRecord> {
  if (!data.name?.trim()) throw new Error('name is required');
  if (!data.triggerType || !data.actionType) throw new Error('triggerType + actionType required');
  return prisma.autoReplyRule.create({
    data: {
      orgId,
      name: data.name.trim(),
      oaAccountId: data.oaAccountId ?? null,
      triggerType: data.triggerType,
      triggerValue: data.triggerValue ?? '',
      actionType: data.actionType,
      actionContent: data.actionContent ?? '',
      priority: data.priority ?? 0,
      enabled: data.enabled ?? true,
    },
  });
}

export async function updateRule(orgId: string, id: string, data: Partial<AutoReplyRuleRecord>): Promise<AutoReplyRuleRecord> {
  const existing = await prisma.autoReplyRule.findFirst({ where: { id, orgId } });
  if (!existing) throw new Error('Rule not found');
  return prisma.autoReplyRule.update({
    where: { id },
    data: {
      name: data.name ?? existing.name,
      oaAccountId: data.oaAccountId ?? existing.oaAccountId,
      triggerType: data.triggerType ?? existing.triggerType,
      triggerValue: data.triggerValue ?? existing.triggerValue,
      actionType: data.actionType ?? existing.actionType,
      actionContent: data.actionContent ?? existing.actionContent,
      priority: data.priority ?? existing.priority,
      enabled: data.enabled ?? existing.enabled,
    },
  });
}

export async function deleteRule(orgId: string, id: string): Promise<void> {
  const existing = await prisma.autoReplyRule.findFirst({ where: { id, orgId } });
  if (!existing) throw new Error('Rule not found');
  await prisma.autoReplyRule.delete({ where: { id } });
}

export async function testRule(triggerType: string, triggerValue: string, sampleMessage: string): Promise<{ matched: boolean }> {
  return { matched: ruleMatches(triggerType, triggerValue, sampleMessage) };
}