# TaskFlow3 Backend

API REST Backend para **TaskFlow3** - Sistema de gestión de tareas y proyectos colaborativos desarrollado con **Node.js**, **Express** y **Prisma ORM**.

# TaskFlow3 Backend

API REST Backend para **TaskFlow3** - Sistema de gestión de tareas y proyectos colaborativos desarrollado con **Node.js**, **Express** y **Prisma ORM**.

##  Características

-  Gestión de usuarios y autenticación
-  Creación y administración de proyectos
-  Sistema de roles (Propietario, Editor, Visor)
-  Organización de tareas en listas
-  Sistema de etiquetas y prioridades
-  Colaboración en proyectos
-  Filtrado de tareas por estado, prioridad y asignación

##  Tecnologías

- **Node.js** - Entorno de ejecución
- **Express 5** - Framework web
- **Prisma 6** - ORM para base de datos
- **MySQL** - Base de datos relacional
- **CORS** - Manejo de peticiones entre dominios

##  Instalación

### Prerrequisitos

- Node.js (v18 o superior)
- MySQL (v8 o superior)
- npm o yarn

### Pasos de instalación

1. **Clonar el repositorio**
```bash
git clone <url-del-repositorio>
cd taskflow3-server
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar variables de entorno**

Crea un archivo `.env` en la raíz del proyecto:

```env
PORT=3000
DATABASE_URL="mysql://usuario:contraseña@localhost:3306/taskflow3_db"
```

4. **Configurar la base de datos**

```bash
# Generar cliente de Prisma
npx prisma generate

# Aplicar migraciones (crear tablas)
npx prisma migrate dev

# Opcional: Abrir Prisma Studio para ver/editar datos
npx prisma studio
```

##  Ejecución

### Modo desarrollo (con auto-reload)
```bash
npm run dev
```

### Modo producción
```bash
npm start
```

El servidor estará disponible en: [http://localhost:3000](http://localhost:3000)

##  Estructura de la Base de Datos

### Tablas principales

- **usuarios** - Información de usuarios del sistema
- **proyectos** - Proyectos y su configuración
- **roles** - Roles de usuario en proyectos
- **proyecto_usuario_rol** - Relación entre proyectos, usuarios y roles
- **listas** - Listas de tareas dentro de proyectos
- **tareas** - Tareas individuales
- **etiquetas** - Etiquetas para clasificar tareas
- **tarea_etiqueta** - Relación entre tareas y etiquetas

### Enumeraciones

- **prioridad_enum**: `Baja`, `Media`, `Alta`

