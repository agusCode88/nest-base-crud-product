import { BadRequestException, Injectable, 
  InternalServerErrorException, Logger,
   NotFoundException, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { DataSource, Repository } from 'typeorm';
import { PaginationDTO } from 'src/common/dtos/pagination.dto';
import { validate as isUUID } from 'uuid';
import { Product ,ProductImage } from './entities';
import { query } from 'express';


@Injectable()
export class ProductsService {
   
  private readonly logger = new Logger('ProductsService');

  constructor(

    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,

    @InjectRepository(ProductImage)
    private readonly productImagesRepository: Repository<ProductImage>,

    private readonly dataSource: DataSource,


  ){}

  async create(createProductDto: CreateProductDto) {
     
     try {

      const { images = [], ...productDetails } = createProductDto;
      
      const product = this.productRepository.create({
        ...productDetails,
        images: images.map( image => this.productImagesRepository.create( { url: image }) )
      });
      await this.productRepository.save(product);

      return { product , images } ;

     } catch (error) {
        this.handleDBException(error); 
     }
     
  }

  //TODO Paginar
  async findAll( paginationDTO: PaginationDTO) {

    const { limit=10 , offset=0} = paginationDTO

    // El find retorna una colección de productos
    const products = await this.productRepository.find({
      take: limit,
      skip: offset,
      relations: {
        images: true,
      }
    });

    // La funcion map transforma un arreglo en otra cosa
    //Aplana una imagen
    return products.map( product => ({
      ...product,
      images: product.images.map ( img => img.url )
    }) )
  }

  async findOne(term: string) {
    
     let product: Product;

     if( isUUID(term)){
      product = await this.productRepository.findOneBy({ id: term });
     } else{
       const queryBuilder = this.productRepository.createQueryBuilder('prod');
       product = await queryBuilder
            .where("LOWER (title) = LOWER (:title) or slug =:slug",{
              title: term,
              slug: term,
            })
            .leftJoinAndSelect('prod.images','prodImages')
            .getOne();
            
     } 

     if(!product) 
        throw new NotFoundException(`Product with id "${term}" not found`);

     return product;
  }

  async findOnePlain( term: string ){
    const { images = [],  ...rest } = await this.findOne( term );
    return {
      ...rest,
      images: images.map( image => image.url )
    }
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    
    const { images, ...toUpdate} = updateProductDto
    
    const product = await this.productRepository.preload({  id , ...toUpdate });

    if( !product ) throw new NotFoundException (`Product with id: ${ id } not found`);

    //Create QueryRunner
    //Transacciones en base de datos, asegurarse de hacer el commit a la BD
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();


    try {

      // Eliminacion de las imagenes que puedan existir
      if( images ){
        await queryRunner.manager.delete( ProductImage, { product: {id} } )
        product.images = images.map ( image => this.productImagesRepository.create({ url:image }))
      } else{
          product.images = await this.productImagesRepository.findBy( { product: {id}} ); 
      }

      await queryRunner.manager.save( product );
      await queryRunner.commitTransaction();
      await queryRunner.release();

      return product;

    } catch (error) {
      
        await queryRunner.rollbackTransaction();
        await queryRunner.release();   

        this.handleDBException(error)
    }    
 
  }

  async remove(id: string) {

    const product = await this.findOne( id );
    await this.productRepository.remove(product);
   
  }

  // Elimina todos los productros de la Base de datos
  async deleteAllProducts(){
    const query = this.productRepository.createQueryBuilder('product');
    try {

      return await query
      .delete()
      .where({})
      .execute()

    } catch (error) {
      this.handleDBException(error);
      
    }
  }

  private handleDBException( error: any ){
    if(error.code === '23505'){
      throw new BadRequestException(error.detail)
     
    }
    this.logger.error(error);
    throw new InternalServerErrorException('Unexpected error,check log server');
  }
}
