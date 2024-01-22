import { Controller, Get, Post, Body, Patch, Param, Delete, UploadedFile, UseInterceptors, BadRequestException, Res } from '@nestjs/common';
import { FilesService } from './files.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { fileFilterHelper } from './helpers/fileFilter.helper';
import { diskStorage } from 'multer';
import { Response } from 'express';
import { fileNarmerHelper } from './helpers/fileNamer.helper';
import { ConfigService } from '@nestjs/config';


@Controller('files')
export class FilesController {
  constructor(
    private readonly filesService: FilesService,
    private readonly configService: ConfigService    
    ) {}

  @Get('product/:imageName')
  findProductImage(
    // Con Res hay que responder manualmente
    @Res() res: Response,
    @Param ('imageName') imageName: string
  ){

    const path = this.filesService.getStaticProductImage ( imageName );

   /*  res.status(403).json({
      ok: false,
      path: path
    }) */

    res.sendFile( path );
     return path;
  }
   
  @Post('product')
  @UseInterceptors( FileInterceptor('file', {
    fileFilter: fileFilterHelper,
    storage: diskStorage({
       destination: './static/products',
       filename: fileNarmerHelper
    })
  }))
  uploadProductImage( @UploadedFile() file: Express.Multer.File){
    
    console.log({ fileInCOntroller: file}); 

    if( !file ){
      throw new BadRequestException('Make sure that file is an image'); 

    }

    const secureUrl = `${ this.configService.get('HOST_API') }/files/product/${ file.filename }`;

    console.log( file );

    return {
      secureUrl
      //filename: file.originalname
    };
  } 
}
