import { Injectable } from '@nestjs/common';
import { ProductsService } from 'src/products/products.service';
import { initialData } from './data/seed-data';


@Injectable()
export class SeedService {

  constructor(
    private readonly productService: ProductsService
  ) {}
  
  async runSeed(){

     this.insertNewProducts();

     return 'SEED EXECUTED';
  }

  private async insertNewProducts(){
    
    await this.productService.deleteAllProducts(); 

    const products = initialData.products;

    const insertPromises = [];
    products.forEach(product => {
       insertPromises.push(this.productService.create ( product ));
    });

    await Promise.all ( insertPromises );

    return true;
  }

}
