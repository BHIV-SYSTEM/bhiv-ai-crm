#!/usr/bin/env python3
"""
LLM Integration for Natural Language CRM Queries
"""

import os
import json
import re
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
try:
    import openai
except ImportError:
    openai = None
from database.crm_service import CRMService

class LLMQuerySystem:
    """Natural language query system for CRM data"""
    
    def __init__(self):
        self.openai_api_key = os.getenv('OPENAI_API_KEY')
        if self.openai_api_key and openai:
            openai.api_key = self.openai_api_key
        
        # Query patterns and their corresponding functions
        self.query_patterns = {
            'opportunities_closing': {
                'patterns': [
                    r'opportunities closing (this|next) (week|month|quarter)',
                    r'deals closing (this|next) (week|month|quarter)',
                    r'what.*opportunities.*closing',
                    r'show.*opportunities.*closing'
                ],
                'function': self.get_opportunities_closing
            },
            'pending_tasks': {
                'patterns': [
                    r'pending tasks for (.+)',
                    r'tasks for (.+)',
                    r'what.*tasks.*(.+)',
                    r'show.*tasks.*(.+)'
                ],
                'function': self.get_pending_tasks
            },
            'leads_by_source': {
                'patterns': [
                    r'leads from (.+)',
                    r'show.*leads.*from (.+)',
                    r'(.+) leads not converted',
                    r'unconverted leads from (.+)'
                ],
                'function': self.get_leads_by_source
            },
            'account_summary': {
                'patterns': [
                    r'account summary for (.+)',
                    r'tell me about (.+)',
                    r'show.*account.*(.+)',
                    r'(.+) account details'
                ],
                'function': self.get_account_summary
            },
            'pipeline_analysis': {
                'patterns': [
                    r'pipeline analysis',
                    r'sales pipeline',
                    r'show.*pipeline',
                    r'pipeline summary'
                ],
                'function': self.get_pipeline_analysis
            },
            'activity_summary': {
                'patterns': [
                    r'recent activities',
                    r'activity summary',
                    r'what.*activities',
                    r'show.*activities'
                ],
                'function': self.get_activity_summary
            }
        }
    
    def process_query(self, query: str, user_context: Optional[Dict] = None) -> Dict:
        """Process natural language query and return results"""
        query_lower = query.lower().strip()
        
        # First try pattern matching
        pattern_result = self.match_query_patterns(query_lower)
        if pattern_result:
            return pattern_result
        
        # Dispatch unhandled queries to UniGuru AI service
        return self.process_with_uniguru(query, user_context)

    def process_with_uniguru(self, query: str, user_context: Optional[Dict] = None) -> Dict:
        """Query UniGuru AI reasoning engine"""
        uniguru_url = os.getenv('UNIGURU_SERVICE_URL', 'http://163.128.209.18:8007').rstrip('/')
        api_token = os.getenv('UNIGURU_API_TOKEN', '')
        caller = os.getenv('UNIGURU_CALLER_NAME', 'bhiv-setu')
        
        headers = {
            'Content-Type': 'application/json',
            'X-Caller-Name': caller
        }
        if api_token:
            headers['Authorization'] = f'Bearer {api_token}'
            headers['X-Service-Token'] = api_token

        payload = {
            'query': query,
            'context': {
                'caller': caller,
                'domain': 'CRM & Logistics',
                **(user_context or {})
            }
        }
        
        try:
            import urllib.request
            req = urllib.request.Request(
                f"{uniguru_url}/ask",
                data=json.dumps(payload).encode('utf-8'),
                headers=headers,
                method='POST'
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                return {
                    'success': True,
                    'query_type': 'uniguru_ai',
                    'data': data,
                    'message': data.get('answer', 'Query processed by UniGuru AI')
                }
        except Exception as e:
            return {
                'success': False,
                'message': f'UniGuru AI query unavailable ({str(e)}). Please try a standard query.',
                'suggestions': [
                    'Show me opportunities closing this month',
                    'What are the pending tasks for John?',
                    'Account summary for TechCorp',
                    'Pipeline analysis'
                ]
            }
    
    def match_query_patterns(self, query: str) -> Optional[Dict]:
        """Match query against predefined patterns"""
        for query_type, config in self.query_patterns.items():
            for pattern in config['patterns']:
                match = re.search(pattern, query)
                if match:
                    try:
                        # Extract parameters from the match
                        params = {}
                        if match.groups():
                            if query_type == 'opportunities_closing':
                                params['period'] = match.group(1)  # this/next
                                params['timeframe'] = match.group(2)  # week/month/quarter
                            elif query_type in ['pending_tasks', 'leads_by_source', 'account_summary']:
                                params['entity'] = match.group(1).strip()
                        
                        # Call the corresponding function
                        result = config['function'](params)
                        return {
                            'success': True,
                            'query_type': query_type,
                            'data': result,
                            'message': f'Found {len(result) if isinstance(result, list) else 1} result(s)'
                        }
                    except Exception as e:
                        return {
                            'success': False,
                            'message': f'Error processing query: {str(e)}'
                        }
        
        return None
    
    def process_with_llm(self, query: str, user_context: Optional[Dict] = None) -> Dict:
        """Process query using OpenAI LLM"""
        if not openai or not self.openai_api_key:
            return {
                'success': False,
                'message': 'OpenAI integration not available. Install openai package and set OPENAI_API_KEY.',
                'suggestions': [
                    'Show me opportunities closing this month',
                    'What are the pending tasks for John?',
                    'List all leads from trade shows not yet converted',
                    'Account summary for TechCorp',
                    'Pipeline analysis',
                    'Recent activities'
                ]
            }
        
        try:
            # Create a prompt to understand the user's intent
            system_prompt = """
            You are a CRM assistant that helps users query their customer relationship management data.
            
            Available data types:
            - Accounts (companies/organizations)
            - Contacts (people within accounts)
            - Leads (potential customers)
            - Opportunities (sales deals)
            - Activities (calls, meetings, emails, visits)
            - Tasks (to-do items)
            
            Available query types:
            1. opportunities_closing - Find opportunities closing in a time period
            2. pending_tasks - Find pending tasks for a person/account
            3. leads_by_source - Find leads from a specific source
            4. account_summary - Get summary of an account
            5. pipeline_analysis - Analyze sales pipeline
            6. activity_summary - Get recent activities
            
            Analyze the user's query and return a JSON response with:
            {
                "query_type": "one of the available query types",
                "parameters": {"key": "value pairs extracted from query"},
                "confidence": "confidence score 0-1"
            }
            """
            
            # Use the newer chat completions API
            response = openai.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": query}
                ],
                max_tokens=200,
                temperature=0.1
            )
            
            # Parse LLM response
            llm_response = response.choices[0].message.content.strip()
            
            try:
                parsed_response = json.loads(llm_response)
                query_type = parsed_response.get('query_type')
                parameters = parsed_response.get('parameters', {})
                confidence = parsed_response.get('confidence', 0.5)
                
                if confidence < 0.6:
                    return {
                        'success': False,
                        'message': 'I\'m not confident about understanding your query. Please try rephrasing.',
                        'llm_interpretation': parsed_response
                    }
                
                # Execute the identified query type
                if query_type in self.query_patterns:
                    result = self.query_patterns[query_type]['function'](parameters)
                    return {
                        'success': True,
                        'query_type': query_type,
                        'data': result,
                        'message': f'Found {len(result) if isinstance(result, list) else 1} result(s)',
                        'llm_interpretation': parsed_response
                    }
                else:
                    return {
                        'success': False,
                        'message': f'Query type "{query_type}" not supported',
                        'llm_interpretation': parsed_response
                    }
                    
            except json.JSONDecodeError:
                return {
                    'success': False,
                    'message': 'Failed to parse LLM response',
                    'raw_response': llm_response
                }
                
        except Exception as e:
            return {
                'success': False,
                'message': f'LLM processing failed: {str(e)}'
            }
    
    def get_opportunities_closing(self, params: Dict) -> List[Dict]:
        """Get opportunities closing in specified timeframe"""
        try:
            with CRMService() as crm:
                # Calculate date range
                now = datetime.now()
                
                period = params.get('period', 'this')
                timeframe = params.get('timeframe', 'month')
                
                start_date = now
                end_date = now + timedelta(days=30)  # default
                
                if period == 'this':
                    if timeframe == 'week':
                        start_date = now
                        end_date = now + timedelta(days=7)
                    elif timeframe == 'month':
                        start_date = now
                        end_date = now + timedelta(days=30)
                    elif timeframe == 'quarter':
                        start_date = now
                        end_date = now + timedelta(days=90)
                else:  # next
                    if timeframe == 'week':
                        start_date = now + timedelta(days=7)
                        end_date = now + timedelta(days=14)
                    elif timeframe == 'month':
                        start_date = now + timedelta(days=30)
                        end_date = now + timedelta(days=60)
                    elif timeframe == 'quarter':
                        start_date = now + timedelta(days=90)
                        end_date = now + timedelta(days=180)
                
                filters = {
                    'is_closed': False,
                    'close_date_from': start_date,
                    'close_date_to': end_date
                }
                
                opportunities = crm.get_opportunities(filters=filters)
                return opportunities
                
        except Exception as e:
            raise Exception(f"Failed to get closing opportunities: {str(e)}")
    
    def get_pending_tasks(self, params: Dict) -> List[Dict]:
        """Get pending tasks for specified entity"""
        try:
            with CRMService() as crm:
                entity = params.get('entity', '').lower()
                
                filters = {'status': 'pending'}
                
                # Try to match entity to account or user
                if entity:
                    # First try as account name
                    accounts = crm.get_accounts()
                    matching_account = None
                    for account in accounts:
                        if entity in account['name'].lower():
                            matching_account = account
                            break
                    
                    if matching_account:
                        filters['account_id'] = matching_account['account_id']
                    else:
                        # Try as assigned user (simplified - in real implementation, 
                        # you'd have a user management system)
                        filters['assigned_to'] = entity.upper()
                
                tasks = crm.get_tasks(filters=filters)
                return tasks
                
        except Exception as e:
            raise Exception(f"Failed to get pending tasks: {str(e)}")
    
    def get_leads_by_source(self, params: Dict) -> List[Dict]:
        """Get leads from specified source"""
        try:
            with CRMService() as crm:
                source = params.get('entity', '').lower()
                
                filters = {'converted': False}
                
                if source:
                    # Map common source variations
                    source_mapping = {
                        'trade show': 'trade_show',
                        'trade shows': 'trade_show',
                        'website': 'website',
                        'web': 'website',
                        'referral': 'referral',
                        'referrals': 'referral',
                        'cold call': 'cold_call',
                        'cold calls': 'cold_call',
                        'social media': 'social_media',
                        'social': 'social_media'
                    }
                    
                    mapped_source = source_mapping.get(source, source.replace(' ', '_'))
                    if mapped_source:
                        filters['lead_source'] = mapped_source
                
                leads = crm.get_leads(filters=filters)
                return leads
                
        except Exception as e:
            raise Exception(f"Failed to get leads by source: {str(e)}")
    
    def get_account_summary(self, params: Dict) -> Dict:
        """Get comprehensive account summary"""
        try:
            with CRMService() as crm:
                entity = params.get('entity', '').lower()
                
                if not entity:
                    raise Exception("Account name not specified")
                
                # Find matching account
                accounts = crm.get_accounts()
                matching_account = None
                
                for account in accounts:
                    if entity in account['name'].lower():
                        matching_account = account
                        break
                
                if not matching_account:
                    raise Exception(f"Account '{entity}' not found")
                
                # Get detailed account information
                account_details = crm.get_account_by_id(matching_account['account_id'])
                
                if not account_details:
                    raise Exception(f"Account details not found for '{entity}'")
                
                return account_details
                
        except Exception as e:
            raise Exception(f"Failed to get account summary: {str(e)}")
    
    def get_pipeline_analysis(self, params: Dict) -> Dict:
        """Get sales pipeline analysis"""
        try:
            with CRMService() as crm:
                opportunities = crm.get_opportunities()
                
                # Analyze by stage
                stage_analysis = {}
                total_value = 0
                weighted_value = 0
                
                for opp in opportunities:
                    stage = opp['stage']
                    amount = opp.get('amount', 0) or 0
                    probability = opp.get('probability', 0) or 0
                    
                    if stage not in stage_analysis:
                        stage_analysis[stage] = {
                            'count': 0,
                            'total_value': 0,
                            'weighted_value': 0,
                            'opportunities': []
                        }
                    
                    stage_analysis[stage]['count'] += 1
                    stage_analysis[stage]['total_value'] += amount
                    stage_analysis[stage]['weighted_value'] += (amount * probability / 100)
                    stage_analysis[stage]['opportunities'].append(opp)
                    
                    total_value += amount
                    weighted_value += (amount * probability / 100)
                
                return {
                    'total_opportunities': len(opportunities),
                    'total_pipeline_value': total_value,
                    'weighted_pipeline_value': weighted_value,
                    'stage_breakdown': stage_analysis,
                    'average_deal_size': total_value / len(opportunities) if opportunities else 0
                }
                
        except Exception as e:
            raise Exception(f"Failed to get pipeline analysis: {str(e)}")
    
    def get_activity_summary(self, params: Dict) -> List[Dict]:
        """Get recent activity summary"""
        try:
            with CRMService() as crm:
                # Get recent activities (last 30 days)
                activities = crm.get_activities(limit=50)
                
                # Filter to recent activities
                recent_activities = []
                cutoff_date = datetime.now() - timedelta(days=30)
                
                for activity in activities:
                    created_at = datetime.fromisoformat(activity['created_at'])
                    if created_at >= cutoff_date:
                        recent_activities.append(activity)
                
                return recent_activities
                
        except Exception as e:
            raise Exception(f"Failed to get activity summary: {str(e)}")
    
    def generate_natural_response(self, query_result: Dict) -> str:
        """Generate natural language response from query results"""
        if not query_result.get('success'):
            return query_result.get('message', 'Sorry, I couldn\'t process your query.')
        
        query_type = query_result.get('query_type')
        data = query_result.get('data', [])
        
        if query_type == 'opportunities_closing':
            if not data:
                return "No opportunities are closing in the specified timeframe."
            
            response = f"I found {len(data)} opportunities closing:\n\n"
            for opp in data[:5]:  # Limit to top 5
                response += f"• {opp['name']} - ${opp.get('amount', 0):,.0f} ({opp.get('probability', 0)}% probability)\n"
            
            if len(data) > 5:
                response += f"\n... and {len(data) - 5} more opportunities."
            
            return response
        
        elif query_type == 'pending_tasks':
            if not data:
                return "No pending tasks found."
            
            response = f"I found {len(data)} pending tasks:\n\n"
            for task in data[:5]:
                response += f"• {task['title']} (Due: {task.get('due_date', 'No due date')})\n"
            
            return response
        
        elif query_type == 'leads_by_source':
            if not data:
                return "No unconverted leads found from the specified source."
            
            response = f"I found {len(data)} unconverted leads:\n\n"
            for lead in data[:5]:
                response += f"• {lead['full_name']} from {lead.get('company', 'Unknown')} (${lead.get('budget', 0):,.0f})\n"
            
            return response
        
        elif query_type == 'account_summary':
            if not data:
                return "Account not found."
            
            account = data
            response = f"**{account['name']}** Summary:\n\n"
            response += f"• Type: {account.get('account_type', 'N/A').title()}\n"
            response += f"• Industry: {account.get('industry', 'N/A')}\n"
            response += f"• Revenue: ${account.get('annual_revenue', 0):,.0f}\n"
            response += f"• Territory: {account.get('territory', 'N/A')}\n"
            response += f"• Contacts: {len(account.get('contacts', []))}\n"
            response += f"• Opportunities: {len(account.get('opportunities', []))}\n"
            
            return response
        
        elif query_type == 'pipeline_analysis':
            if not data:
                return "No pipeline data available."
            
            response = f"**Pipeline Analysis:**\n\n"
            response += f"• Total Opportunities: {data['total_opportunities']}\n"
            response += f"• Pipeline Value: ${data['total_pipeline_value']:,.0f}\n"
            response += f"• Weighted Value: ${data['weighted_pipeline_value']:,.0f}\n"
            response += f"• Average Deal Size: ${data['average_deal_size']:,.0f}\n\n"
            
            response += "**By Stage:**\n"
            for stage, info in data['stage_breakdown'].items():
                response += f"• {stage.title()}: {info['count']} deals (${info['total_value']:,.0f})\n"
            
            return response
        
        elif query_type == 'activity_summary':
            if not data:
                return "No recent activities found."
            
            response = f"I found {len(data)} recent activities:\n\n"
            for activity in data[:5]:
                response += f"• {activity['subject']} ({activity['activity_type']}) - {activity.get('status', 'N/A')}\n"
            
            return response
        
        else:
            return f"Found {len(data) if isinstance(data, list) else 1} result(s) for your query."

# Example usage and testing
def test_llm_query_system():
    """Test LLM query system"""
    llm_system = LLMQuerySystem()
    
    # Test queries
    test_queries = [
        "Show me all opportunities closing this month",
        "What are the pending tasks for TechCorp?",
        "List all leads from trade shows not yet converted",
        "Account summary for TechCorp Industries",
        "Pipeline analysis",
        "Recent activities"
    ]
    
    print("Testing LLM Query System...")
    
    for query in test_queries:
        print(f"\nQuery: {query}")
        try:
            result = llm_system.process_query(query)
            response = llm_system.generate_natural_response(result)
            print(f"Response: {response}")
        except Exception as e:
            print(f"Error: {e}")
    
    print("\nLLM Query System tests completed")

if __name__ == "__main__":
    test_llm_query_system()