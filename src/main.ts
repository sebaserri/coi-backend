import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { PrismaService } from "./prisma/prisma.service";
import * as bodyParser from 'body-parser';
import { RawBodyMiddleware } from './middlewares/raw-body.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true, rawBody: true, });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  app.use(bodyParser.json({
    verify: (req: any, _res, buf) => { req.rawBody = buf; },
  }));
  app.use(bodyParser.urlencoded({
    extended: true,
    verify: (req: any, _res, buf) => { req.rawBody = buf; },
  }));

  const prismaService = app.get(PrismaService);
  await prismaService.enableShutdownHooks(app);

  const config = new DocumentBuilder()
    .setTitle("COI MVP API")
    .setDescription("API para gestión de COIs (ACORD 25)")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("docs", app, document, {
    jsonDocumentUrl: "docs-json",
  });

  await app.listen(process.env.PORT || 3000);
}
bootstrap();
