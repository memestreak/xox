/**
 * ESLint rule: no-conditional-border
 *
 * Flags string literals containing "border" inside
 * conditional expressions (ternaries) when the other
 * branch does not also contain "border". Conditional
 * borders cause 1px layout shift — always apply border
 * unconditionally and toggle the color instead.
 */

const BORDER_RE = /\bborder\b/;

/** Check if a node is a string-like literal. */
function isStringLike(node) {
  return (
    (node.type === 'Literal'
      && typeof node.value === 'string')
    || (node.type === 'TemplateLiteral')
  );
}

/** Extract raw text from a string literal or template. */
function getText(node) {
  if (node.type === 'Literal') return node.value;
  if (node.type === 'TemplateLiteral') {
    return node.quasis.map(q => q.value.raw).join('');
  }
  return '';
}

/**
 * Collect all string content reachable from a node via
 * binary `+` concatenation, template literals, or nested
 * conditionals (both branches).
 */
function collectStrings(node) {
  if (!node) return '';
  if (isStringLike(node)) return getText(node);
  if (
    node.type === 'BinaryExpression'
    && node.operator === '+'
  ) {
    return (
      collectStrings(node.left)
      + collectStrings(node.right)
    );
  }
  if (node.type === 'ConditionalExpression') {
    return (
      collectStrings(node.consequent)
      + ' '
      + collectStrings(node.alternate)
    );
  }
  return '';
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow "border" in only one branch of a'
        + ' conditional — causes layout shift',
    },
    messages: {
      conditionalBorder:
        '"border" appears in only one branch of this'
        + ' conditional. Apply border unconditionally'
        + ' and toggle the color instead'
        + ' (e.g., border-transparent).',
    },
    schema: [],
  },
  create(context) {
    return {
      ConditionalExpression(node) {
        const consText = collectStrings(node.consequent);
        const altText = collectStrings(node.alternate);
        const consHas = BORDER_RE.test(consText);
        const altHas = BORDER_RE.test(altText);

        if (consHas !== altHas) {
          context.report({
            node,
            messageId: 'conditionalBorder',
          });
        }
      },
    };
  },
};

export default rule;
