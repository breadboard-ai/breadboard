FROM NODE:lts

COPY . .

RUN npm install
RUN npm run build

EXPOSE 3000
CMD ["node", "dist/server/main.js"]
