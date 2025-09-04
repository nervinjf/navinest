module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn('contactos', 'fibranet', {
            type: Sequelize.BOOLEAN,
            defaultValue: false,
        });
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.removeColumn('contactos', 'fibranet');
    }
};