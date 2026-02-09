import chalk from 'chalk'

export const logger = {
  info: (message: string) => console.log(chalk.blue('[INFO]'), message),
  success: (message: string) => console.log(chalk.green('[OK]'), message),
  warn: (message: string) => console.log(chalk.yellow('[WARN]'), message),
  error: (message: string) => console.log(chalk.red('[ERROR]'), message),

  header: (title: string) => {
    console.log('')
    console.log(chalk.blue('╔' + '═'.repeat(60) + '╗'))
    console.log(chalk.blue('║') + title.padStart(30 + title.length / 2).padEnd(60) + chalk.blue('║'))
    console.log(chalk.blue('╚' + '═'.repeat(60) + '╝'))
    console.log('')
  },

  section: (title: string) => {
    console.log('')
    console.log(chalk.blue(`── ${title} ──`))
  },

  complete: () => {
    console.log('')
    console.log(chalk.green('╔' + '═'.repeat(60) + '╗'))
    console.log(chalk.green('║') + 'Sync Complete'.padStart(36).padEnd(60) + chalk.green('║'))
    console.log(chalk.green('╚' + '═'.repeat(60) + '╝'))
    console.log('')
  },
}
