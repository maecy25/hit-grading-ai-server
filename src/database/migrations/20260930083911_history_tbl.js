/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  if( !(await knex.schema.hasTable('history_tbl')) ){
        return knex.schema.createTable('history_tbl', table => {
            table.increments('history_id').primary(); //PK auto increment
            table.string('device_type', 100);
            table.string('device_ip_address', 100);
            table.string('device_location', 100);
            table.string('tcg_type', 50);
            table.string('card_name', 100);
            table.string('card_code', 255);
            table.text('chck_ai_data');
        })
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  if( await knex.schema.hasTable('history_tbl') ){
        return knex.schema.dropTable('history_tbl')
    }
};
