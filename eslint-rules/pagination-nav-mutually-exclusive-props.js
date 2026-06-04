/**
 * @fileoverview Ensures PaginationNav uses either buildUrl or onPageChange, never both.
 *
 * PaginationNav supports two mutually exclusive navigation modes:
 * - `buildUrl` (Link-based, SSR-friendly)
 * - `onPageChange` (onClick-based, client-side)
 *
 * Passing both causes `onPageChange` to silently take precedence,
 * which can lead to confusing behavior.
 */

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'PaginationNav must use either buildUrl or onPageChange, never both simultaneously.',
      category: 'Possible Errors',
      recommended: true,
    },
    messages: {
      bothProps:
        'PaginationNav must not receive both `buildUrl` and `onPageChange`. Use only one — `buildUrl` for Link-based navigation or `onPageChange` for callback-based navigation.',
    },
    schema: [],
  },

  create(context) {
    return {
      JSXOpeningElement(node) {
        // Match <PaginationNav ... />
        const name = node.name;
        const isPaginationNav =
          (name.type === 'JSXIdentifier' && name.name === 'PaginationNav') ||
          (name.type === 'JSXMemberExpression' &&
            name.property &&
            name.property.name === 'PaginationNav');

        if (!isPaginationNav) return;

        const attrs = node.attributes || [];
        let hasBuildUrl = false;
        let hasOnPageChange = false;

        for (const attr of attrs) {
          if (attr.type !== 'JSXAttribute' || !attr.name) continue;
          if (attr.name.name === 'buildUrl') hasBuildUrl = true;
          if (attr.name.name === 'onPageChange') hasOnPageChange = true;
        }

        if (hasBuildUrl && hasOnPageChange) {
          context.report({
            node,
            messageId: 'bothProps',
          });
        }
      },
    };
  },
};
