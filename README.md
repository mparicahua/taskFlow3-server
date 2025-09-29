# TaskFlow3 Backend

API Backend para **TaskFlow3** desarrollada con **Node.js**, **Express** y **Prisma**.


```sh
npm install
```

### Configurar variables de entorno  
Crea un archivo `.env` en la raíz del proyecto con el siguiente contenido:
```sh
PORT=3000

DATABASE_URL="mysql://root:password@localhost:3306/taskflow3_db"
```


```sh
npx prisma generate
```

```sh
npx prisma studio
```

```sh
npm run dev
```

Servidor corriendo en: [http://localhost:3000](http://localhost:3000)


```sh
npm start
```


