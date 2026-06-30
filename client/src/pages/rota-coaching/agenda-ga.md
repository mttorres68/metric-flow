criar um form para implementar as agendas dos GAs.

São 5 revendas, para cada revenda uma quantidade de GA, no mesmo é seguir o padrão já aplicado. 

formr com select da revenda - tem no banco de dados essa informação.
para preencher os code fazer um insert no bd - primeiro cria a tabelam gas_code com as seguintes:

![1782140044718](image/agenda-ga/1782140044718.png)

- 

segue modelo de UI.

![1782140091248](image/agenda-ga/1782140091248.png)


Em revenda, fazer um select, em semana é o intervalo de datas da semana

no caso de vendedores-setores = code (errei no nome)

id é opcional - a coluna code - já preenche os 6 dias na semana ao selecionar em code, a colula data faz o preenchimento automatico, atividade é um select por padrão vem preenchido com "Outra Atividade", dia da semana, e vendedor será aplicado conforme a agenda, e descrição como de texto. 


na ui final aplique o design padrão e bem intuitivo.
