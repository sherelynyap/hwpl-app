import React from 'react';
import Markdown from 'react-native-markdown-display';
import { useTheme } from '../theme';

export default function MarkdownText({ children, color }) {
  const { theme } = useTheme();
  const accentColor = color || theme.accentText;

  return (
    <Markdown style={markdownStyles(theme, accentColor)}>
      {children}
    </Markdown>
  );
}

const markdownStyles = (theme, accentColor) => ({
  body: { color: theme.text, fontSize: 15, lineHeight: 21 },
  heading1: { color: theme.text, fontSize: 20, fontWeight: '700', marginTop: 8, marginBottom: 6 },
  heading2: { color: theme.text, fontSize: 18, fontWeight: '700', marginTop: 8, marginBottom: 6 },
  heading3: { color: accentColor, fontSize: 16, fontWeight: '700', marginTop: 6, marginBottom: 4 },
  strong: { color: theme.text, fontWeight: '700' },
  em: { color: theme.muted, fontStyle: 'italic' },
  bullet_list: { marginVertical: 4 },
  ordered_list: { marginVertical: 4 },
  list_item: { color: theme.text, marginBottom: 4, flexDirection: 'row' },
  bullet_list_icon: { color: accentColor, marginRight: 6 },
  ordered_list_icon: { color: accentColor, marginRight: 6 },
  paragraph: { marginTop: 0, marginBottom: 8 },
  hr: { backgroundColor: theme.border, height: 1, marginVertical: 10 },
  blockquote: {
    backgroundColor: theme.surface,
    borderLeftWidth: 3,
    borderLeftColor: accentColor,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginVertical: 6,
  },
  code_inline: {
    backgroundColor: theme.border,
    color: accentColor,
    borderRadius: 4,
    paddingHorizontal: 4,
  },
  code_block: {
    backgroundColor: theme.border,
    color: theme.text,
    borderRadius: 8,
    padding: 10,
  },
  link: { color: accentColor },
});