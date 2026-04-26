// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  rules: {
    'vue/multi-word-component-names': 'off',
    'vue/html-self-closing': ['error', {
      html: { void: 'always', normal: 'always', component: 'always' },
    }],
    '@stylistic/comma-dangle': ['error', 'always-multiline'],
    '@stylistic/arrow-parens': ['error', 'always'],
    '@stylistic/operator-linebreak': ['error', 'before'],
  },
})
