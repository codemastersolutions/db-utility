IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'dbutility_test')
BEGIN
    CREATE DATABASE dbutility_test;
END
GO

USE dbutility_test;
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'customers')
BEGIN
    CREATE TABLE customers (
        id INT IDENTITY(1,1) PRIMARY KEY,
        name NVARCHAR(100) NOT NULL,
        email NVARCHAR(150) NOT NULL UNIQUE,
        is_active BIT NOT NULL DEFAULT 1,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'products')
BEGIN
    CREATE TABLE products (
        id INT IDENTITY(1,1) PRIMARY KEY,
        name NVARCHAR(120) NOT NULL,
        description NVARCHAR(MAX) NULL,
        price DECIMAL(18, 2) NOT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'orders')
BEGIN
    CREATE TABLE orders (
        id INT IDENTITY(1,1) PRIMARY KEY,
        customer_id INT NOT NULL,
        status NVARCHAR(20) NOT NULL,
        total_amount DECIMAL(18, 2) NOT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT fk_orders_customers FOREIGN KEY (customer_id) REFERENCES customers (id)
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'order_items')
BEGIN
    CREATE TABLE order_items (
        id INT IDENTITY(1,1) PRIMARY KEY,
        order_id INT NOT NULL,
        product_id INT NOT NULL,
        quantity INT NOT NULL,
        unit_price DECIMAL(18, 2) NOT NULL,
        CONSTRAINT fk_order_items_orders FOREIGN KEY (order_id) REFERENCES orders (id),
        CONSTRAINT fk_order_items_products FOREIGN KEY (product_id) REFERENCES products (id)
    );
END
GO
