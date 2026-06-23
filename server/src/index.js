import { createServer } from 'http'
import handler from '../../api/index.js'

const server = createServer((req, res) => {
  handler(req, res)
})

const PORT = process.env.PORT || 4000
server.listen(PORT, () => {
  console.log('🎴 Servidor de Lotería (REST) en http://localhost:' + PORT)
})
