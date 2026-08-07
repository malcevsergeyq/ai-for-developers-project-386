import { createApp } from './app.js';
import { createPool } from './db.js';
import { createEventTypesRepository } from './repositories/event-types.repository.js';

const pool = createPool();
const app = createApp({ eventTypesRepository: createEventTypesRepository(pool) });

const port = process.env.PORT ?? 3000;
app.listen(port, () => {
  console.log(`Сервер слушает http://localhost:${port}`);
});
